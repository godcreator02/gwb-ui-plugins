import { describe, expect, it } from 'vitest'
import { createWellHub } from '../src/client/well-hub.js'
import type { DockviewApi } from 'dockview-react'
import type { PanelLike } from '../src/panels.js'

/**
 * 全井枢纽的账本：井的进出、活动桌面的同拍语义、一张桌面的快照、实例在哪张桌面、
 * 组的最近激活顺序、命令口与注入钩子的收放。假井只喂 `panels` / `getPanel` / `groups` /
 * `activeGroup` 那几格形状。
 */

type FakePanel = PanelLike & { id: string }

/** 一组假组：标签按顺序、活动标签、矩形 */
interface FakeGroup {
  id: string
  panels: FakePanel[]
  active?: string
  box?: { x: number; y: number; w: number; h: number }
}

/** 一口假井：组按顺序摆着，panels 是各组标签摊平，getPanel 按 id 找 */
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

/** 一口只有一组的假井 */
function oneGroup(panels: FakePanel[]): DockviewApi {
  return fakeWell([{ id: 'g1', panels }], 'g1')
}

/** 一格插件窗格的 params 三件套 */
function pane(id: string, extra: Record<string, unknown> = {}): FakePanel {
  return {
    id,
    view: { contentComponent: 'plugin' },
    params: { pluginKey: 'pkg', entryId: 'e1', paneId: 'main', ...extra },
  }
}

describe('井的进出', () => {
  it('挂上就查得到，clearWells 全拆且活动桌面归零', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([]))
    hub.setActiveDesktop('d1')
    hub.noteActiveGroup('d1', 'g1')
    expect(hub.wells().size).toBe(1)
    hub.clearWells()
    expect(hub.wells().size).toBe(0)
    expect(hub.activeDesktop()).toBe('')
    // 最近激活的账跟着井一起清
    hub.addWell('d1', fakeWell([{ id: 'g1', panels: [] }]))
    expect(hub.deskOf('d1')?.recent).toEqual([])
  })
})

describe('removeWell：删掉一张桌面时拆它的井', () => {
  it('井与最近激活的账一起摘，别的桌面不动', () => {
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

describe('deskOf：一张桌面的快照，只摘这一张', () => {
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

  it('没挂井的桌面回 undefined', () => {
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

  it('已经没了的组记账时顺手摘掉，账不会越记越长', () => {
    const hub = createWellHub()
    const groups: FakeGroup[] = [{ id: 'g1', panels: [] }]
    hub.addWell('d1', fakeWell(groups))
    hub.noteActiveGroup('d1', 'old')
    hub.noteActiveGroup('d1', 'g1')
    expect(hub.deskOf('d1')?.recent).toEqual(['g1'])
  })
})

describe('注册表缓存：同步地问「这一格是哪一类」', () => {
  it('记下最近取到的那份表；表里没有的（件卸了）当 tool', () => {
    const hub = createWellHub()
    expect(hub.paneKind('e1', 'main')).toBe('tool')
    hub.notePanes([{ entryId: 'e1', pkg: 'pkg', id: 'main', title: 'M', kind: 'document' }])
    expect(hub.paneKind('e1', 'main')).toBe('document')
    expect(hub.paneKind('e1', 'other')).toBe('tool')
  })
})

describe('entries：切换器与 shell.pane.list 的清单', () => {
  it('挂着的桌面从活井摘，没挂过的桌面从落盘布局读，按桌面顺序', () => {
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

  it('没注入桌面操作（外壳还没落树）时回空清单', () => {
    expect(createWellHub().entries()).toEqual([])
  })

  it('递进来桌面清单就照它摘，不等注入（开机那一下井的 onReady 比注入早）', () => {
    const hub = createWellHub()
    hub.addWell('d1', oneGroup([pane('plugin:e1:main')]))
    expect(hub.entries([{ id: 'd1', name: '桌面 1', layout: null }]).map((e) => [e.desktop, e.instance])).toEqual([
      ['d1', 'plugin:e1:main'],
    ])
  })
})

describe('takenAnywhere：实例 id 全页唯一', () => {
  it('别的井里占着也算占', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([]))
    hub.addWell('d2', oneGroup([pane('plugin:e1:main:2')]))
    expect(hub.takenAnywhere('plugin:e1:main')).toBe(false)
    expect(hub.takenAnywhere('plugin:e1:main:2')).toBe(true)
  })
})

describe('命令口与注入钩子', () => {
  it('releaseHost 只收自己那份——新壳先挂、旧壳后收，不能把新的清掉', () => {
    const hub = createWellHub()
    const first = { call: async () => undefined }
    const second = { call: async () => undefined }
    hub.setHost(first)
    hub.releaseHost(second)
    expect(hub.host()).toBe(first)
    hub.releaseHost(first)
    expect(hub.host()).toBeUndefined()
  })

  it('桌面操作摘了之后是 undefined', () => {
    const hub = createWellHub()
    hub.setDeskOps({ switchTo: () => undefined, ensureMounted: async () => undefined, rows: () => [], createDesktop: () => '', notify: () => undefined })
    expect(hub.deskOps()).toBeDefined()
    hub.setDeskOps(undefined)
    expect(hub.deskOps()).toBeUndefined()
  })

  it('flush 扳的是最新的那个钩子，摘了之后再扳是空操作', () => {
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
