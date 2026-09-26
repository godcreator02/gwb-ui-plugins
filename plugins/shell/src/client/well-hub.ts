import type { DockviewApi } from 'dockview-react'
import { entryIdOf, isPreviewPanel, paneIdOf, paneKeyOf, type PanelLike } from '../panels.js'
import type { Desk, DeskGroup, PaneKind } from '../openable.js'
import { entriesOfLayout, entryOf, type PaneEntry } from '../pane-list.js'
import type { DesktopRow } from '../layout.js'
import type { HostBridge, PaneRow } from './types.js'

/** App 注入的桌面操作：面板组件与标签菜单访问不到 App 的闭包，显式的桌面动作经它执行 */
export interface DeskOps {
  switchTo(desktopId: string): void
  /** 没挂载过就在后台挂载、不显示，挂载完成回它的 api；桌面不存在回 undefined */
  ensureMounted(desktopId: string): Promise<DockviewApi | undefined>
  /** 桌面清单与各自保存的布局（没挂载过的桌面从这里读开着什么） */
  rows(): readonly DesktopRow[]
  /** 新建一张空桌面、不切过去，回它的 id；名字空串用缺省名 */
  createDesktop(name: string): string
  /** 状态栏显示「<text> · 切过去」，点它切到这张桌面 */
  notify(desktopId: string, text: string): void
}

/**
 * 外壳浏览器侧的页面级状态：容器注册表、活动桌面、保存钩子、命令入口、组的最近激活顺序。
 * `setActiveDesktop` 当场生效；实例 id 查重看所有容器（`takenAnywhere`），开窗格的判断只看一张桌面（`deskOf`）
 */
export interface WellHub {
  host(): HostBridge | undefined
  setHost(host: HostBridge): void
  /** 只在当前的就是它时清掉：换外壳时新外壳先 boot、旧外壳后 dispose */
  releaseHost(candidate: HostBridge): void
  /** 容器挂载后常驻，不卸载 */
  addWell(desktopId: string, api: DockviewApi): void
  /** 删除桌面时连同那张桌面上组的最近激活顺序一起删 */
  removeWell(desktopId: string): void
  wells(): ReadonlyMap<string, DockviewApi>
  /** App 卸载时：容器全删、活动桌面清空、最近激活顺序清空 */
  clearWells(): void
  activeDesktop(): string
  setActiveDesktop(desktopId: string): void
  /** 卸载 React 树前立刻保存一次的钩子（App 注入 `flushSave`），bootShell 的 dispose 调它 */
  setFlusher(flush: (() => void) | undefined): void
  flush(): void
  /** `planOpen` 用的桌面快照；容器没挂载回 undefined */
  deskOf(desktopId: string): Desk | undefined
  /** 这个实例在哪张桌面；哪个容器都没有回 undefined */
  locate(panelId: string): string | undefined
  /** 某一组被激活（含拖放落进去）；只在运行时记 */
  noteActiveGroup(desktopId: string, groupId: string): void
  takenAnywhere(panelId: string): boolean
  /** `fetchPanes` 每取一次注册表就记一次 */
  notePanes(rows: readonly PaneRow[]): void
  /** 按最近取到的注册表；表里没有（插件卸载了）当 tool */
  paneKind(entryId: string, paneId: string): PaneKind
  /** App 挂载时注入、卸载时移除 */
  setDeskOps(ops: DeskOps | undefined): void
  deskOps(): DeskOps | undefined
  /**
   * 所有桌面上开着的窗格，按桌面顺序：已挂载的从容器读，没挂载过的从保存的布局读。
   * 桌面清单缺省问注入的桌面操作，还没注入时抛错；开机时容器的 onReady 比注入早，由调用方传入
   */
  entries(rows?: readonly DesktopRow[]): PaneEntry[]
}

/** dockview 组上本模块要看的那部分形状 */
interface GroupLike {
  id: string
  panels: readonly (PanelLike & { id: string; title?: string })[]
  activePanel?: { id: string } | undefined
  element: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } }
}

function mountedEntries(desktop: string, api: DockviewApi): PaneEntry[] {
  const entries: PaneEntry[] = []
  for (const group of groupsOf(api)) {
    for (const panel of group.panels) {
      const entry = entryOf(
        desktop,
        group.id,
        { id: panel.id, ...(panel.title === undefined ? {} : { title: panel.title }), ...(panel.params === undefined ? {} : { params: panel.params }) },
        group.activePanel?.id === panel.id,
      )
      if (entry !== undefined) entries.push(entry)
    }
  }
  return entries
}

/** 矩形取页面坐标：藏起来的桌面是 visibility:hidden，照样有布局 */
function deskGroupOf(group: GroupLike): DeskGroup {
  const rect = group.element.getBoundingClientRect()
  const activePanelId = group.activePanel?.id
  return {
    id: group.id,
    tabs: group.panels.map((panel) => ({
      id: panel.id,
      entryId: entryIdOf(panel),
      paneId: paneIdOf(panel),
      key: paneKeyOf(panel),
      preview: isPreviewPanel(panel),
    })),
    ...(activePanelId === undefined ? {} : { active: activePanelId }),
    box: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
  }
}

function groupsOf(api: DockviewApi): readonly GroupLike[] {
  return api.groups as unknown as readonly GroupLike[]
}

/** 换行符不会出现在条目 id 与窗格 id 里，拿它拼键不会重 */
function paneKindKey(entryId: string, paneId: string): string {
  return `${entryId}\n${paneId}`
}

export function createWellHub(): WellHub {
  let currentHost: HostBridge | undefined
  const containersByDesktop = new Map<string, DockviewApi>()
  /** 最近的在前 */
  const recentGroupsByDesktop = new Map<string, string[]>()
  const paneKinds = new Map<string, PaneKind>()
  let activeDesktopId = ''
  let flushSave: (() => void) | undefined
  let injectedDeskOps: DeskOps | undefined

  return {
    host() {
      return currentHost
    },
    setHost(host) {
      currentHost = host
    },
    releaseHost(candidate) {
      if (currentHost === candidate) currentHost = undefined
    },
    addWell(desktopId, api) {
      containersByDesktop.set(desktopId, api)
    },
    removeWell(desktopId) {
      containersByDesktop.delete(desktopId)
      recentGroupsByDesktop.delete(desktopId)
    },
    wells() {
      return containersByDesktop
    },
    clearWells() {
      containersByDesktop.clear()
      recentGroupsByDesktop.clear()
      activeDesktopId = ''
    },
    activeDesktop() {
      return activeDesktopId
    },
    setActiveDesktop(desktopId) {
      activeDesktopId = desktopId
    },
    setFlusher(flush) {
      flushSave = flush
    },
    flush() {
      flushSave?.()
    },
    deskOf(desktopId) {
      const api = containersByDesktop.get(desktopId)
      if (api === undefined) return undefined
      const activeGroup = api.activeGroup?.id
      return {
        groups: groupsOf(api).map(deskGroupOf),
        ...(activeGroup === undefined ? {} : { activeGroup }),
        recent: recentGroupsByDesktop.get(desktopId) ?? [],
      }
    },
    locate(panelId) {
      for (const [desktop, api] of containersByDesktop) {
        if (api.getPanel(panelId) !== undefined) return desktop
      }
      return undefined
    },
    noteActiveGroup(desktopId, groupId) {
      const api = containersByDesktop.get(desktopId)
      // 订阅在 addWell 之后才建、在 removeWell / clearWells 之前注销
      if (api === undefined) throw new Error(`[shell] 给桌面 ${desktopId} 记组的激活顺序时它的容器不在——订阅没跟着容器一起注销`)
      const existingGroupIds = new Set(groupsOf(api).map((group) => group.id))
      // 顺手去掉已经不在的组，顺序表不会越记越长
      const olderGroupIds = (recentGroupsByDesktop.get(desktopId) ?? []).filter((id) => id !== groupId && existingGroupIds.has(id))
      recentGroupsByDesktop.set(desktopId, [groupId, ...olderGroupIds])
    },
    takenAnywhere(panelId) {
      for (const api of containersByDesktop.values()) {
        if (api.getPanel(panelId) !== undefined) return true
      }
      return false
    },
    notePanes(rows) {
      paneKinds.clear()
      for (const row of rows) paneKinds.set(paneKindKey(row.entryId, row.id), row.kind)
    },
    paneKind(entryId, paneId) {
      return paneKinds.get(paneKindKey(entryId, paneId)) ?? 'tool'
    },
    setDeskOps(next) {
      injectedDeskOps = next
    },
    deskOps() {
      return injectedDeskOps
    },
    entries(rows = injectedDeskOps?.rows()) {
      // 回空表的话推给 node 侧就成了「一个窗格都没开」
      if (rows === undefined) throw new Error('[shell] 列开着的窗格要桌面清单：桌面操作还没注入，调用方得自己传进来')
      return rows.flatMap((row) => {
        const api = containersByDesktop.get(row.id)
        return api === undefined ? entriesOfLayout(row.id, row.layout) : mountedEntries(row.id, api)
      })
    },
  }
}

/** 一页只有一个外壳；组件表访问不到 App 的闭包，都经这一份 */
export const wellHub: WellHub = createWellHub()
