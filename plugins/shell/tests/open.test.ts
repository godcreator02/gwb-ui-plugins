import type { DockviewApi } from 'dockview-react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  TAB_COMPONENT,
  addInstance,
  closeInstance,
  focusInstance,
  launchGoesTo,
  launchSpec,
  openRegisteredPane,
  sendPane,
} from '../src/client/open.js'
import { wellHub, type DeskOps } from '../src/client/well-hub.js'
import type { HostBridge, PaneRow } from '../src/client/types.js'
import { specForPane } from '../src/openable.js'
import type { DesktopRow } from '../src/layout.js'

/**
 * 开窗格的执行侧（`client/open.ts`）：按现在的行为检查判断落成的 dockview 动作。
 * dockview 用一个只实现用到那几个方法的替身，桌面操作、命令入口也用替身，经 wellHub 注入。
 */

interface FakePanel {
  id: string
  title: string | undefined
  params: Record<string, unknown> | undefined
  view: { contentComponent: string }
  group: FakeGroup
  api: {
    setActive(): void
    close(): void
    updateParameters(update: Record<string, unknown>): void
    moveTo(target: { group: FakeGroup; position: string }): void
  }
}

interface FakeGroup {
  id: string
  panels: FakePanel[]
  activePanel: FakePanel | undefined
  element: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } }
  api: { height: number; setSize(size: { height: number }): void }
}

interface AddPanelOptions {
  id: string
  component: string
  tabComponent?: string
  title?: string
  params?: Record<string, unknown>
  position?: { referenceGroup: string | FakeGroup; index?: number }
  inactive?: boolean
}

function fakeDockview(desktop: string, log: string[]) {
  const groups: FakeGroup[] = []
  let activeGroup: FakeGroup | undefined
  const addPanelCalls: AddPanelOptions[] = []

  function newGroup(id: string, box = { left: 0, top: 0, width: 400, height: 300 }): FakeGroup {
    const group: FakeGroup = {
      id,
      panels: [],
      activePanel: undefined,
      element: { getBoundingClientRect: () => box },
      api: {
        height: box.height,
        setSize: (size) => log.push(`${desktop} setSize ${id} ${String(size.height)}`),
      },
    }
    groups.push(group)
    return group
  }

  function newPanel(group: FakeGroup, id: string, title: string | undefined, params: Record<string, unknown> | undefined, component = 'plugin'): FakePanel {
    const panel: FakePanel = {
      id,
      title,
      params,
      view: { contentComponent: component },
      group,
      api: {
        setActive: () => {
          log.push(`${desktop} setActive ${panel.id}`)
          panel.group.activePanel = panel
          activeGroup = panel.group
        },
        close: () => {
          log.push(`${desktop} close ${panel.id}`)
          panel.group.panels = panel.group.panels.filter((candidate) => candidate !== panel)
        },
        updateParameters: (update) => {
          log.push(`${desktop} updateParameters ${panel.id} ${JSON.stringify(update, (_key, value: unknown) => (value === undefined ? '<undefined>' : value))}`)
          const merged: Record<string, unknown> = { ...panel.params }
          for (const [key, value] of Object.entries(update)) {
            if (value === undefined) delete merged[key]
            else merged[key] = value
          }
          panel.params = merged
        },
        moveTo: (target) => log.push(`${desktop} moveTo ${panel.id} ${target.group.id} ${target.position}`),
      },
    }
    return panel
  }

  const api = {
    get groups() {
      return groups
    },
    get activeGroup() {
      return activeGroup
    },
    getPanel(id: string): FakePanel | undefined {
      for (const group of groups) {
        const panel = group.panels.find((candidate) => candidate.id === id)
        if (panel !== undefined) return panel
      }
      return undefined
    },
    addPanel(options: AddPanelOptions): FakePanel {
      addPanelCalls.push(options)
      log.push(`${desktop} addPanel ${options.id}`)
      const reference = options.position?.referenceGroup
      const group =
        reference === undefined
          ? (activeGroup ?? newGroup(`${desktop}-g${String(groups.length + 1)}`))
          : typeof reference === 'string'
            ? groups.find((candidate) => candidate.id === reference)!
            : reference
      const panel = newPanel(group, options.id, options.title, options.params)
      const index = options.position?.index ?? group.panels.length
      group.panels.splice(index, 0, panel)
      if (options.inactive !== true) {
        group.activePanel = panel
        activeGroup = group
      }
      return panel
    },
  }

  return {
    api,
    addPanelCalls,
    newGroup,
    /** 按插件窗格的形状放一份进某一组 */
    seed(group: FakeGroup, id: string, params: Record<string, unknown>, title?: string, active = false): FakePanel {
      const panel = newPanel(group, id, title, params)
      group.panels.push(panel)
      if (active) {
        group.activePanel = panel
        activeGroup = group
      }
      return panel
    },
  }
}

const hello = { entryId: 'home:hello', pkg: '@t/gwb-hello' }
const toolRow: PaneRow = { ...hello, id: 'tool', title: '工具', kind: 'tool' }
const docRow: PaneRow = { ...hello, id: 'doc', title: '文档', kind: 'document' }

function pluginParams(paneId: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { pluginKey: hello.pkg, entryId: hello.entryId, paneId, key: '', ...extra }
}

function fakeHost(rows: PaneRow[]): HostBridge {
  return { call: () => Promise.resolve({ ok: true, data: rows }) }
}

function asApi(api: ReturnType<typeof fakeDockview>['api']): DockviewApi {
  return api as unknown as DockviewApi
}

function setup(options: { desktops: string[]; active: string; rows?: PaneRow[] }) {
  const log: string[] = []
  const docks = new Map(options.desktops.map((id) => [id, fakeDockview(id, log)]))
  const desktopRows: DesktopRow[] = options.desktops.map((id, index) => ({ id, name: `桌面 ${String(index + 1)}`, layout: null }))
  const notices: string[] = []
  const deskOps: DeskOps = {
    switchTo: (desktopId) => {
      log.push(`switchTo ${desktopId}`)
      wellHub.setActiveDesktop(desktopId)
    },
    ensureMounted: (desktopId) => {
      const dock = docks.get(desktopId)
      if (dock === undefined) return Promise.resolve(undefined)
      wellHub.addWell(desktopId, asApi(dock.api))
      return Promise.resolve(asApi(dock.api))
    },
    rows: () => desktopRows,
    createDesktop: (name) => {
      const id = `d${String(desktopRows.length + 1)}`
      desktopRows.push({ id, name: name === '' ? `桌面 ${String(desktopRows.length + 1)}` : name, layout: null })
      docks.set(id, fakeDockview(id, log))
      log.push(`createDesktop ${id}`)
      return id
    },
    notify: (desktopId, text) => notices.push(`${desktopId}: ${text}`),
  }
  wellHub.setDeskOps(deskOps)
  wellHub.setHost(fakeHost(options.rows ?? [toolRow, docRow]))
  for (const id of options.desktops) wellHub.addWell(id, asApi(docks.get(id)!.api))
  wellHub.setActiveDesktop(options.active)
  return { log, docks, notices, dock: (id: string) => docks.get(id)! }
}

let warn: MockInstance<typeof console.warn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  warn.mockRestore()
  const host = wellHub.host()
  if (host !== undefined) wellHub.releaseHost(host)
  wellHub.setDeskOps(undefined)
  wellHub.clearWells()
})

describe('addInstance', () => {
  it('实例 id 查所有容器：别的桌面占了基名，这里开出 :2，标题带 (2)', () => {
    const { dock } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    const other = dock('d2').newGroup('d2-g1')
    dock('d2').seed(other, 'plugin:home:hello:doc', pluginParams('doc'))
    addInstance(asApi(dock('d1').api), specForPane({ ...docRow }))
    expect(dock('d1').addPanelCalls).toEqual([
      {
        id: 'plugin:home:hello:doc:2',
        component: 'plugin',
        tabComponent: TAB_COMPONENT,
        title: '文档 (2)',
        params: { pluginKey: hello.pkg, entryId: hello.entryId, paneId: 'doc' },
      },
    ])
  })
})

describe('启动器：launchGoesTo / launchSpec', () => {
  it('工具窗格当前桌面开着回「当前桌面」，别的桌面开着回那张桌面的名字，没开着回 undefined；文档窗格一律 undefined', () => {
    const { dock } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    const toolSpec = specForPane(toolRow)
    expect(launchGoesTo(toolSpec)).toBeUndefined()
    const otherGroup = dock('d2').newGroup('d2-g1')
    dock('d2').seed(otherGroup, 'plugin:home:hello:tool', pluginParams('tool'))
    expect(launchGoesTo(toolSpec)).toBe('桌面 2')
    dock('d1').seed(group, 'plugin:home:hello:tool:2', pluginParams('tool'))
    expect(launchGoesTo(toolSpec)).toBe('当前桌面')
    dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc'))
    expect(launchGoesTo(specForPane(docRow))).toBeUndefined()
  })

  it('没开着的工具窗格开进活动组、插在活动标签右边', async () => {
    const { dock } = setup({ desktops: ['d1'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'a', pluginParams('other'), 'A', true)
    dock('d1').seed(group, 'b', pluginParams('other2'), 'B')
    await launchSpec(specForPane(toolRow))
    expect(dock('d1').addPanelCalls[0]).toMatchObject({ id: 'plugin:home:hello:tool', position: { referenceGroup: 'd1-g1', index: 1 } })
    expect(group.panels.map((panel) => panel.id)).toEqual(['a', 'plugin:home:hello:tool', 'b'])
  })

  it('工具窗格开在别的桌面上：切过去、激活它；是预览就顺带转正', async () => {
    const { dock, log, notices } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    dock('d1').newGroup('d1-g1')
    const otherGroup = dock('d2').newGroup('d2-g1')
    dock('d2').seed(otherGroup, 'plugin:home:hello:tool', pluginParams('tool', { preview: true }), '工具')
    await launchSpec(specForPane(toolRow))
    expect(log).toEqual([
      'switchTo d2',
      'd2 updateParameters plugin:home:hello:tool {"preview":"<undefined>"}',
      'd2 setActive plugin:home:hello:tool',
    ])
    expect(notices).toEqual([])
  })

  it('活动桌面的容器没挂上：抛错，不装作点了没反应', async () => {
    setup({ desktops: ['d1'], active: 'd1' })
    wellHub.setActiveDesktop('d9')
    await expect(launchSpec(specForPane(toolRow))).rejects.toThrow('d9')
    expect(() => launchGoesTo(specForPane(toolRow))).toThrow('d9')
  })
})

describe('openRegisteredPane', () => {
  it('同一个 key 已开着：激活它，不新开', async () => {
    const { dock, log } = setup({ desktops: ['d1'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc', { key: 'a.md' }), '文档', true)
    await openRegisteredPane(wellHub.host()!, { entryId: hello.entryId, paneId: 'doc' }, { key: 'a.md' })
    expect(log).toEqual(['d1 setActive plugin:home:hello:doc'])
  })

  it('preview 打开、目标组已有这个窗格的预览：软换，旧参数里多出来的键写成 undefined', async () => {
    const { dock, log } = setup({ desktops: ['d1'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    const previewPanel = dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc', { key: 'a.md', preview: true, file: 'a.md', old: 1 }), '文档', true)
    await openRegisteredPane(wellHub.host()!, { entryId: hello.entryId, paneId: 'doc' }, { key: 'b.md', preview: true, params: { file: 'b.md' } })
    expect(log).toEqual([
      'd1 updateParameters plugin:home:hello:doc {"old":"<undefined>","file":"b.md","pluginKey":"@t/gwb-hello","entryId":"home:hello","paneId":"doc","key":"b.md","preview":true}',
      'd1 setActive plugin:home:hello:doc',
    ])
    expect(previewPanel.params).toEqual({ pluginKey: hello.pkg, entryId: hello.entryId, paneId: 'doc', key: 'b.md', preview: true, file: 'b.md' })
  })

  it('传了保留键：照常打开，console 里 warn 一句', async () => {
    const { dock } = setup({ desktops: ['d1'], active: 'd1' })
    dock('d1').newGroup('d1-g1')
    await openRegisteredPane(wellHub.host()!, { entryId: hello.entryId, paneId: 'doc' }, { params: { entryId: 'x', file: 'a' } })
    expect(dock('d1').addPanelCalls[0]?.params).toEqual({ file: 'a', pluginKey: hello.pkg, entryId: hello.entryId, paneId: 'doc', key: '' })
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual(['[shell] 窗格 doc 传的 params 里 entryId 是外壳的保留键，已摘掉'])
  })

  it('placement side 且右边没有组：先不激活地开进基准组，再移到它右边，高度有变化就补回去', async () => {
    const { dock, log } = setup({ desktops: ['d1'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'src', pluginParams('other'), 'S', true)
    const originalAddPanel = dock('d1').api.addPanel.bind(dock('d1').api)
    dock('d1').api.addPanel = (options) => {
      const panel = originalAddPanel(options)
      group.api.height = 290
      return panel
    }
    await openRegisteredPane(wellHub.host()!, { entryId: hello.entryId, paneId: 'doc' }, { placement: 'side' }, 'src')
    expect(dock('d1').addPanelCalls[0]).toMatchObject({ id: 'plugin:home:hello:doc', position: { referenceGroup: group }, inactive: true })
    expect(log).toEqual(['d1 addPanel plugin:home:hello:doc', 'd1 moveTo plugin:home:hello:doc d1-g1 right', 'd1 setSize d1-g1 310'])
  })

  it('来源窗格哪张桌面都没有：warn 一句，当没有来源、开在当前桌面', async () => {
    const { dock } = setup({ desktops: ['d1'], active: 'd1' })
    dock('d1').newGroup('d1-g1')
    await openRegisteredPane(wellHub.host()!, { entryId: hello.entryId, paneId: 'doc' }, undefined, 'nowhere')
    expect(String(warn.mock.calls[0]?.[0])).toContain('来源窗格 nowhere 哪张桌面都没有')
    expect(dock('d1').addPanelCalls).toHaveLength(1)
  })

  it('工具窗格开在别的桌面上：不切桌面，在那张桌面激活它，状态栏提示一句', async () => {
    const { dock, log, notices } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    dock('d1').newGroup('d1-g1')
    const otherGroup = dock('d2').newGroup('d2-g1')
    dock('d2').seed(otherGroup, 'plugin:home:hello:tool', pluginParams('tool'), '工具')
    await openRegisteredPane(wellHub.host()!, { entryId: hello.entryId, paneId: 'tool' }, undefined)
    await Promise.resolve()
    expect(log).toEqual(['d2 setActive plugin:home:hello:tool'])
    expect(notices).toEqual(['d2: 『工具』在『桌面 2』'])
  })

  it('窗格不在注册表里：什么都不开，warn 说清是谁要开什么', async () => {
    const { dock } = setup({ desktops: ['d1'], active: 'd1', rows: [] })
    dock('d1').newGroup('d1-g1')
    await openRegisteredPane(wellHub.host()!, { entryId: hello.entryId, paneId: 'doc' }, undefined)
    expect(dock('d1').addPanelCalls).toEqual([])
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual(['[shell] 条目 home:hello 要开的窗格 doc 不在注册表里'])
  })
})

describe('focusInstance / closeInstance', () => {
  it('focusInstance：在别的桌面就先切过去再激活', async () => {
    const { dock, log } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    const otherGroup = dock('d2').newGroup('d2-g1')
    dock('d2').seed(otherGroup, 'p', pluginParams('doc'))
    await focusInstance('d2', 'p')
    expect(log).toEqual(['switchTo d2', 'd2 setActive p'])
  })

  it('closeInstance：不切桌面，直接关', async () => {
    const { dock, log } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    const otherGroup = dock('d2').newGroup('d2-g1')
    dock('d2').seed(otherGroup, 'p', pluginParams('doc'))
    await closeInstance('d2', 'p')
    expect(log).toEqual(['d2 close p'])
  })

  it('桌面操作还没注入：抛错', async () => {
    await expect(focusInstance('d1', 'p')).rejects.toThrow('桌面操作')
    await expect(closeInstance('d1', 'p')).rejects.toThrow('桌面操作')
  })
})

describe('sendPane', () => {
  it('哪张桌面都没有这个实例：warn，不动', async () => {
    const { log } = setup({ desktops: ['d1'], active: 'd1' })
    await sendPane('ghost', { desktop: 'd1' }, false)
    expect(log).toEqual([])
    expect(String(warn.mock.calls[0]?.[0])).toContain('窗格 ghost 哪张桌面都没有')
  })

  it('送到它本来那张：只激活它', async () => {
    const { dock, log } = setup({ desktops: ['d1'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc'), '文档')
    await sendPane('plugin:home:hello:doc', { desktop: 'd1' }, false)
    expect(log).toEqual(['d1 setActive plugin:home:hello:doc'])
  })

  it('送到别的桌面：源桌面关掉，目标桌面开一份正式的，带上 key、插件参数与改过的标题，状态栏提示', async () => {
    const { dock, log, notices } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc', { key: 'a.md', preview: true, file: 'a.md' }), '改过的标题')
    dock('d2').newGroup('d2-g1')
    await sendPane('plugin:home:hello:doc', { desktop: 'd2' }, false)
    expect(log).toEqual(['d1 close plugin:home:hello:doc', 'd2 addPanel plugin:home:hello:doc'])
    expect(dock('d2').addPanelCalls[0]).toMatchObject({
      title: '改过的标题',
      params: { file: 'a.md', pluginKey: hello.pkg, entryId: hello.entryId, paneId: 'doc', key: 'a.md' },
    })
    expect(dock('d2').addPanelCalls[0]?.params).not.toHaveProperty('preview')
    expect(notices).toEqual(['d2: 已送到『桌面 2』'])
  })

  it('送到新桌面、定义已不在注册表里：不建桌面、不关源窗格，warn 一句', async () => {
    const { dock, log } = setup({ desktops: ['d1'], active: 'd1', rows: [] })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc'), '文档')
    await sendPane('plugin:home:hello:doc', { newDesktop: '' }, false)
    expect(log).toEqual([])
    expect(String(warn.mock.calls[0]?.[0])).toContain('定义不在注册表里')
  })

  it('目标桌面挂上了却读不出快照：抛错，而且不先关掉源窗格（关了开不回来，这一份就没了）', async () => {
    const { dock, log } = setup({ desktops: ['d1', 'd2'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc'), '文档')
    const ops = wellHub.deskOps()!
    wellHub.removeWell('d2')
    wellHub.setDeskOps({
      ...ops,
      ensureMounted: (desktopId) => (desktopId === 'd2' ? Promise.resolve(asApi(dock('d2').api)) : ops.ensureMounted(desktopId)),
    })
    await expect(sendPane('plugin:home:hello:doc', { desktop: 'd2' }, false)).rejects.toThrow('d2')
    expect(log).toEqual([])
  })

  it('follow：送完切过去，不提示；newDesktop：先建一张桌面', async () => {
    const { dock, log, notices } = setup({ desktops: ['d1'], active: 'd1' })
    const group = dock('d1').newGroup('d1-g1')
    dock('d1').seed(group, 'plugin:home:hello:doc', pluginParams('doc'), '文档')
    await sendPane('plugin:home:hello:doc', { newDesktop: '' }, true)
    expect(log).toEqual(['createDesktop d2', 'd1 close plugin:home:hello:doc', 'd2 addPanel plugin:home:hello:doc', 'switchTo d2'])
    expect(notices).toEqual([])
  })
})
