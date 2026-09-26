import { describe, expect, it } from 'vitest'
import { createWellHub } from '../src/client/well-hub.js'
import type { DockviewApi } from 'dockview-react'
import type { PanelLike } from '../src/panels.js'

/**
 * wellHub 记的页面级状态：容器的加入与删除、活动桌面当场生效、一张桌面的快照、实例在哪张桌面、
 * 组的最近激活顺序、命令入口与注入的钩子。假容器只实现 `panels` / `getPanel` / `groups` /
 * `activeGroup` 这几项。
 */

type FakePanel = PanelLike & { id: string }

/** 一组假组：标签按顺序、活动标签、矩形 */
interface FakeGroup {
  id: string
  panels: FakePanel[]
  active?: string
  box?: { x: number; y: number; w: number; h: number }
}

/** 假容器：组按顺序排列，panels 是各组标签连成一列，getPanel 按 id 找 */
function fakeWell(groups: FakeGroup[], activeGroup?: string): DockviewApi {
  const rows = groups.flatMap((g) => g.panels)
  return {
    panels: rows,
    getPanel: (id: string) => rows.find((row) => row.id === id),
    groups: groups.map((g) => ({
      id: g.id,
      panels: g.panels.map((p) => ({ ...p, title: p.id })),
      activePanel: g.panels.find((p) => p.id === g.active),
      element: {
        getBoundingClientRect: () => {
          const b = g.box ?? { x: 0, y: 0, w: 100, h: 100 }
          return { left: b.x, top: b.y, width: b.w, height: b.h }
        },
      },
    })),
    activeGroup: groups.find((g) => g.id === activeGroup) === undefined ? undefined : { id: activeGroup },
  } as unknown as DockviewApi
}

/** 只有一组的假容器 */
function oneGroup(panels: FakePanel[]): DockviewApi {
  return fakeWell([{ id: 'g1', panels }], 'g1')
}

/** 一份插件窗格，params 带 pluginKey / entryId / paneId */
function pane(id: string, extra: Record<string, unknown> = {}): FakePanel {
  return {
    id,
    view: { contentComponent: 'plugin' },
    params: { pluginKey: 'pkg', entryId: 'e1', paneId: 'main', ...extra },
  }
}

describe('容器的加入与删除', () => {
  it('加入就查得到，clearWells 全部删除且活动桌面清空', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([]))
    hub.setActiveDesktop('d1')
    hub.noteActiveGroup('d1', 'g1')
    expect(hub.wells().size).toBe(1)
    hub.clearWells()
    expect(hub.wells().size).toBe(0)
    expect(hub.activeDesktop()).toBe('')
    // 最近激活顺序跟着容器一起清掉
    hub.addWell('d1', fakeWell([{ id: 'g1', panels: [] }]))
    expect(hub.deskOf('d1')?.recent).toEqual([])
  })
})

describe('removeWell：删掉一张桌面时删它的容器', () => {
  it('容器与最近激活顺序一起删，别的桌面不动', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([{ id: 'g1', panels: [] }]))
    hub.addWell('d2', fakeWell([{ id: 'g1', panels: [pane('plugin:e1:main')] }]))
    hub.noteActiveGroup('d2', 'g1')
    hub.removeWell('d2')
    expect([...hub.wells().keys()]).toEqual(['d1'])
    expect(hub.locate('plugin:e1:main')).toBeUndefined()
    hub.addWell('d2', fakeWell([{ id: 'g1', panels: [] }]))
    expect(hub.deskOf('d2')?.recent).toEqual([])
  })
})

describe('活动桌面的同拍语义', () => {
  it('setActiveDesktop 之后当场读到新值，不等下一拍', () => {
    const hub = createWellHub()
    hub.setActiveDesktop('d2')
    expect(hub.activeDesktop()).toBe('d2')
  })
})

describe('deskOf：一张桌面的快照，只读这一张', () => {
  it('组按顺序、标签按标签条顺序，每个标签带定义、key、预览；组带活动标签与矩形', () => {
    const hub = createWellHub()
    hub.addWell(
      'd1',
      fakeWell(
        [
          { id: 'g1', panels: [pane('plugin:e1:main', { key: 'a' }), pane('plugin:e1:other', { paneId: 'other' })], active: 'plugin:e1:other', box: { x: 8, y: 8, w: 300, h: 600 } },
          { id: 'g2', panels: [pane('plugin:e1:main:2', { key: 'b', preview: true })], active: 'plugin:e1:main:2', box: { x: 316, y: 8, w: 300, h: 600 } },
        ],
        'g2',
      ),
    )
    expect(hub.deskOf('d1')).toEqual({
      groups: [
        {
          id: 'g1',
          tabs: [
            { id: 'plugin:e1:main', entryId: 'e1', paneId: 'main', key: 'a', preview: false },
            { id: 'plugin:e1:other', entryId: 'e1', paneId: 'other', key: '', preview: false },
          ],
          active: 'plugin:e1:other',
          box: { x: 8, y: 8, w: 300, h: 600 },
        },
        {
          id: 'g2',
          tabs: [{ id: 'plugin:e1:main:2', entryId: 'e1', paneId: 'main', key: 'b', preview: true }],
          active: 'plugin:e1:main:2',
          box: { x: 316, y: 8, w: 300, h: 600 },
        },
      ],
      activeGroup: 'g2',
      recent: [],
    })
  })

  it('别的桌面开着什么不进这张快照——本桌优先', () => {
    const hub = createWellHub()
    hub.addWell('d1', oneGroup([pane('plugin:e1:main', { key: 'a' })]))
    hub.addWell('d2', oneGroup([pane('plugin:e1:main:2', { key: 'a' })]))
    expect(hub.deskOf('d1')?.groups.flatMap((g) => g.tabs.map((t) => t.id))).toEqual(['plugin:e1:main'])
  })

  it('没挂载容器的桌面回 undefined', () => {
    expect(createWellHub().deskOf('nope')).toBeUndefined()
  })
})

describe('locate：一个实例开在哪张桌面', () => {
  it('找得到回桌面 id，找不到回 undefined', () => {
    const hub = createWellHub()
    hub.addWell('d1', oneGroup([pane('plugin:e1:main')]))
    hub.addWell('d2', oneGroup([pane('plugin:e1:main:2')]))
    expect(hub.locate('plugin:e1:main:2')).toBe('d2')
    expect(hub.locate('plugin:e1:ghost')).toBeUndefined()
  })
})

describe('最近用过的组：按桌面记激活顺序，只在运行时', () => {
  it('最近的在前、同一组再激活挪到最前，两张桌面各记各的', () => {
    const hub = createWellHub()
    const groups = [{ id: 'g1', panels: [] }, { id: 'g2', panels: [] }, { id: 'g3', panels: [] }]
    hub.addWell('d1', fakeWell(groups))
    hub.addWell('d2', fakeWell(groups))
    hub.noteActiveGroup('d1', 'g1')
    hub.noteActiveGroup('d1', 'g2')
    hub.noteActiveGroup('d1', 'g1')
    hub.noteActiveGroup('d2', 'g3')
    expect(hub.deskOf('d1')?.recent).toEqual(['g1', 'g2'])
    expect(hub.deskOf('d2')?.recent).toEqual(['g3'])
  })

  it('已经不在的组，记顺序时顺手去掉，顺序表不会越记越长', () => {
    const hub = createWellHub()
    const groups: FakeGroup[] = [{ id: 'g1', panels: [] }]
    hub.addWell('d1', fakeWell(groups))
    hub.noteActiveGroup('d1', 'old')
    hub.noteActiveGroup('d1', 'g1')
    expect(hub.deskOf('d1')?.recent).toEqual(['g1'])
  })

  it('记顺序的桌面没挂载容器：抛错（订阅在加入容器之后才建、在删除容器之前注销）', () => {
    expect(() => createWellHub().noteActiveGroup('d1', 'g1')).toThrow('d1')
  })
})

describe('注册表缓存：同步地问「这个窗格是哪一类」', () => {
  it('记下最近取到的那份表；表里没有的（插件卸载了）当 tool', () => {
    const hub = createWellHub()
    expect(hub.paneKind('e1', 'main')).toBe('tool')
    hub.notePanes([{ entryId: 'e1', pkg: 'pkg', id: 'main', title: 'M', kind: 'document' }])
    expect(hub.paneKind('e1', 'main')).toBe('document')
    expect(hub.paneKind('e1', 'other')).toBe('tool')
  })
})

describe('entries：切换器与 shell.pane.list 的清单', () => {
  it('已挂载的桌面从容器读，没挂载过的桌面从保存的布局读，按桌面顺序', () => {
    const hub = createWellHub()
    hub.addWell(
      'd1',
      fakeWell([{ id: 'g1', panels: [pane('plugin:e1:main', { key: 'a' }), pane('plugin:e1:main:2', { preview: true })], active: 'plugin:e1:main:2' }]),
    )
    hub.setDeskOps({
      switchTo: () => undefined,
      ensureMounted: async () => undefined,
      createDesktop: () => '',
      notify: () => undefined,
      rows: () => [
        { id: 'd1', name: '桌面 1', layout: null },
        {
          id: 'd2',
          name: '桌面 2',
          layout: {
            grid: { root: { type: 'leaf', data: { id: '7', views: ['plugin:e1:main:3'], activeView: 'plugin:e1:main:3' } } },
            panels: {
              'plugin:e1:main:3': {
                id: 'plugin:e1:main:3',
                contentComponent: 'plugin',
                title: '三',
                params: { pluginKey: 'pkg', entryId: 'e1', paneId: 'main', key: 'c' },
              },
            },
          },
        },
      ],
    })
    expect(hub.entries().map((e) => [e.desktop, e.group, e.instance, e.key, e.preview, e.active])).toEqual([
      ['d1', 'g1', 'plugin:e1:main', 'a', false, false],
      ['d1', 'g1', 'plugin:e1:main:2', '', true, true],
      ['d2', '7', 'plugin:e1:main:3', 'c', false, true],
    ])
  })

  it('没注入桌面操作、也没递桌面清单：抛错——回空清单的话推给 node 侧就成了「一个窗格都没开」', () => {
    expect(() => createWellHub().entries()).toThrow('桌面清单')
  })

  it('传入桌面清单就照它读，不等注入（开机时容器的 onReady 比注入早）', () => {
    const hub = createWellHub()
    hub.addWell('d1', oneGroup([pane('plugin:e1:main')]))
    expect(hub.entries([{ id: 'd1', name: '桌面 1', layout: null }]).map((e) => [e.desktop, e.instance])).toEqual([
      ['d1', 'plugin:e1:main'],
    ])
  })
})

describe('takenAnywhere：实例 id 全页唯一', () => {
  it('别的容器里占着也算占用', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([]))
    hub.addWell('d2', oneGroup([pane('plugin:e1:main:2')]))
    expect(hub.takenAnywhere('plugin:e1:main')).toBe(false)
    expect(hub.takenAnywhere('plugin:e1:main:2')).toBe(true)
  })
})

describe('命令入口与注入的钩子', () => {
  it('releaseHost 只清掉自己那份——换外壳时新外壳先挂载、旧外壳后卸载，不能把新的清掉', () => {
    const hub = createWellHub()
    const first = { call: async () => undefined }
    const second = { call: async () => undefined }
    hub.setHost(first)
    hub.releaseHost(second)
    expect(hub.host()).toBe(first)
    hub.releaseHost(first)
    expect(hub.host()).toBeUndefined()
  })

  it('桌面操作移除之后是 undefined', () => {
    const hub = createWellHub()
    hub.setDeskOps({ switchTo: () => undefined, ensureMounted: async () => undefined, rows: () => [], createDesktop: () => '', notify: () => undefined })
    expect(hub.deskOps()).toBeDefined()
    hub.setDeskOps(undefined)
    expect(hub.deskOps()).toBeUndefined()
  })

  it('flush 调的是最新注入的那个钩子，移除之后再调什么都不做', () => {
    const hub = createWellHub()
    const calls: string[] = []
    hub.setFlusher(() => calls.push('one'))
    hub.flush()
    hub.setFlusher(() => calls.push('two'))
    hub.flush()
    hub.setFlusher(undefined)
    hub.flush()
    expect(calls).toEqual(['one', 'two'])
  })
})
