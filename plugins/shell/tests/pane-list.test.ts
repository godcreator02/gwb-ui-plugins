import { describe, expect, it } from 'vitest'
import { entriesOfLayout, entryOf, orderForSwitcher, tabsToClose, type PaneEntry } from '../src/pane-list.js'

describe('tabsToClose：标签菜单的「关闭其他」「关闭右侧」', () => {
  const order = ['a', 'b', 'c', 'd']
  it('关闭其他：同一组里除了自己的全部，按标签顺序', () => {
    expect(tabsToClose(order, 'b', 'others')).toEqual(['a', 'c', 'd'])
  })
  it('关闭右侧：自己右边的那几个', () => {
    expect(tabsToClose(order, 'b', 'right')).toEqual(['c', 'd'])
    expect(tabsToClose(order, 'd', 'right')).toEqual([])
  })
  it('自己不在这一组（刚被拖走）：什么都不关', () => {
    expect(tabsToClose(order, 'x', 'others')).toEqual([])
    expect(tabsToClose(order, 'x', 'right')).toEqual([])
  })
})

/**
 * 窗格清单的一行：切换器（状态栏「窗格」）与 `shell.pane.list` 吃同一个形状。挂着的桌面从活井
 * 现摘，**没挂过的桌面从落盘的那份布局里读**——切换器要列出所有桌面上开着的窗格，而没切去过
 * 的桌面根本没有井。
 */

const params = (paneId: string, extra: Record<string, unknown> = {}) => ({
  pluginKey: '@x/note',
  entryId: 'home:note',
  paneId,
  icon: 'book',
  ...extra,
})

describe('entryOf：一份面板 → 一行', () => {
  it('身份、内容 key、标题、图标、预览、是不是那组的活动标签', () => {
    expect(
      entryOf('d1', 'g1', { id: 'plugin:home:note:reader', title: '正文', params: params('reader', { key: 'lib:a', preview: true }) }, true),
    ).toEqual({
      instance: 'plugin:home:note:reader',
      desktop: 'd1',
      group: 'g1',
      pkg: '@x/note',
      entryId: 'home:note',
      paneId: 'reader',
      key: 'lib:a',
      title: '正文',
      icon: 'book',
      preview: true,
      active: true,
    })
  })

  it('不是插件窗格（params 缺识别三件套）回 undefined，不进清单', () => {
    expect(entryOf('d1', 'g1', { id: 'x', title: 'X', params: {} }, false)).toBeUndefined()
  })

  it('没给过 key 就是空串，没有 preview 键就是正式窗格', () => {
    const row = entryOf('d1', 'g1', { id: 'p', title: 'P', params: params('reader') }, false)
    expect(row).toMatchObject({ key: '', preview: false, active: false })
  })
})

/** dockview toJSON 的形状（只摆本模块读的那几格） */
function saved() {
  return {
    grid: {
      root: {
        type: 'branch',
        data: [
          { type: 'leaf', data: { id: '1', views: ['plugin:home:note:reader', 'plugin:home:note:reader:2'], activeView: 'plugin:home:note:reader:2' } },
          {
            type: 'branch',
            data: [{ type: 'leaf', data: { id: '3', views: ['plugin:home:note:list'], activeView: 'plugin:home:note:list' } }],
          },
        ],
      },
      width: 1000,
      height: 600,
      orientation: 'HORIZONTAL',
    },
    panels: {
      'plugin:home:note:reader': { id: 'plugin:home:note:reader', contentComponent: 'plugin', title: '正文', params: params('reader', { key: 'lib:a' }) },
      'plugin:home:note:reader:2': {
        id: 'plugin:home:note:reader:2',
        contentComponent: 'plugin',
        title: '第二块',
        params: params('reader', { key: 'lib:b', preview: true }),
      },
      'plugin:home:note:list': { id: 'plugin:home:note:list', contentComponent: 'plugin', title: '目录', params: params('list') },
    },
    activeGroup: '1',
  }
}

describe('entriesOfLayout：没挂过的桌面，从落盘的布局里读', () => {
  it('按组、组内标签的顺序列出来；活动标签认得出来', () => {
    const rows = entriesOfLayout('d2', saved())
    expect(rows.map((r) => [r.instance, r.group, r.key, r.preview, r.active])).toEqual([
      ['plugin:home:note:reader', '1', 'lib:a', false, false],
      ['plugin:home:note:reader:2', '1', 'lib:b', true, true],
      ['plugin:home:note:list', '3', '', false, true],
    ])
    expect(rows[1]!.title).toBe('第二块')
    expect(rows.every((r) => r.desktop === 'd2')).toBe(true)
  })

  it('还没存过（null）或者形状认不出：空清单，不抛', () => {
    expect(entriesOfLayout('d2', null)).toEqual([])
    expect(entriesOfLayout('d2', { grid: 3 })).toEqual([])
    expect(entriesOfLayout('d2', { grid: { root: { type: 'leaf', data: { views: ['ghost'] } } }, panels: {} })).toEqual([])
  })
})

describe('orderForSwitcher：当前桌面在最前，其余照桌面顺序', () => {
  it('分组、排序、带上桌面名与「当前」', () => {
    const row = (desktop: string, instance: string): PaneEntry => ({
      instance,
      desktop,
      group: 'g',
      pkg: 'p',
      entryId: 'e',
      paneId: 'x',
      key: '',
      title: instance,
      preview: false,
      active: false,
    })
    const groups = orderForSwitcher(
      [
        { id: 'd1', name: '桌面 1' },
        { id: 'd2', name: '写作' },
        { id: 'd3', name: '空的' },
      ],
      'd2',
      [row('d1', 'a'), row('d2', 'b'), row('d1', 'c')],
    )
    expect(groups.map((g) => [g.desktop, g.name, g.current, g.rows.map((r) => r.instance)])).toEqual([
      ['d2', '写作', true, ['b']],
      ['d1', '桌面 1', false, ['a', 'c']],
      ['d3', '空的', false, []],
    ])
  })
})
