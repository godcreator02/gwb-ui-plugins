import type { DockviewApi } from 'dockview-react'
import { entryIdOf, isPreviewPanel, paneIdOf, paneKeyOf, type PanelLike } from '../panels.js'
import type { Desk, DeskGroup, PaneKind } from '../openable.js'
import { entriesOfLayout, entryOf, type PaneEntry } from '../pane-list.js'
import type { DesktopRow } from '../layout.js'
import type { HostBridge, PaneRow } from './types.js'

/**
 * App 注入的桌面操作：切桌、后台挂井、桌面清单。面板组件与标签菜单够不着 App 的闭包，
 * 要做**显式**的桌面动作（点「桌面」面板里别的桌面上的一个窗格、送到别的桌面）从这儿过。
 */
export interface DeskOps {
  /** 显式切到这张桌面 */
  switchTo(desktopId: string): void
  /** 把这张桌面的容器挂上（没挂过就在后台冷挂、不显示），挂好了回它的 api；桌面不存在回 undefined */
  ensureMounted(desktopId: string): Promise<DockviewApi | undefined>
  /** 桌面清单：名字与落盘布局（没挂过的桌面从这儿读它开着什么） */
  rows(): readonly DesktopRow[]
  /** 新建一张空桌面，**不切过去**（「送到新桌面」用），回它的 id。名字空串用缺省名 */
  createDesktop(name: string): string
  /**
   * 状态栏出一句「<text> · 切过去」，点它切到这张桌面：送到别的桌面之后（「已送到『X』」）、插件或
   * 命令打开的工具窗格开在别的桌面上时（「『插件管理』在『X』」）
   */
  notify(desktopId: string, text: string): void
}

/**
 * 全井枢纽：井注册表、活动桌面、落盘钩子、命令口、组的最近激活顺序——外壳浏览器半的全部
 * 页面级状态，收在一个有声明接口的对象里。
 *
 * **为什么是模块级单例而不是 React 状态**：面板组件表必须是模块级常量（换引用会让
 * dockview 重建全部格），组件因此拿不到 App 的闭包；塞进 `params` 则会跟着布局落盘。
 * 两条时序约定归在这两处：
 *
 * - `setActiveDesktop` **当场生效（同拍）**：`switchTo` 先改它再改 React 状态
 * - **实例 id 全页唯一**：查重看全井（`takenAnywhere`）；开格的判断却只看一张桌面
 *   （`deskOf`）——本桌优先，打开从来不切桌面
 *
 * 对 dockview 只读 `panels` / `getPanel` / `groups` / `activeGroup` 与组元素的矩形，
 * 测试里喂假井就能跑；零 react。
 */
export interface WellHub {
  /** 命令口。boot 挂上，热换外壳的 dispose 收回 */
  host(): HostBridge | undefined
  setHost(host: HostBridge): void
  /** 只在「现在这份就是它」时清——热换的自然顺序是新的先 boot、旧的后 dispose，不判身份就会把新壳的那份清掉 */
  releaseHost(candidate: HostBridge): void
  /** 一口井挂上（常驻保活，挂上就不拆） */
  addWell(desktopId: string, api: DockviewApi): void
  /** 删掉一张桌面时拆它的井，连同那张桌面上组的最近激活顺序 */
  removeWell(desktopId: string): void
  /** 此刻活着的井，desktopId → api */
  wells(): ReadonlyMap<string, DockviewApi>
  /** App 卸载那趟：井全拆、活动桌面归零、最近激活的账清空 */
  clearWells(): void
  /** 活动桌面 id */
  activeDesktop(): string
  setActiveDesktop(desktopId: string): void
  /** 拆树前抢一把落盘的钩子（App 注入 `flushSave`），bootShell 的 dispose 扳它 */
  setFlusher(flush: (() => void) | undefined): void
  flush(): void
  /** 这张桌面此刻的样子（`planOpen` 吃的那份）。井没挂上回 undefined */
  deskOf(desktopId: string): Desk | undefined
  /** 这个实例开在哪张桌面。哪口井都没有回 undefined */
  locate(panelId: string): string | undefined
  /** 这张桌面上某一组被激活了（含拖放落进去）。只在运行时记，不落盘 */
  noteActiveGroup(desktopId: string, groupId: string): void
  /** 这个 id 在任何一口井里已经有格了吗 */
  takenAnywhere(panelId: string): boolean
  /** 记下最近取到的注册表（`fetchPanes` 每取一次就记一次） */
  notePanes(rows: readonly PaneRow[]): void
  /** 这一格是哪一类，按最近取到的注册表；表里没有（件卸了）当 tool */
  paneKind(entryId: string, paneId: string): PaneKind
  /** App 落树时注入桌面操作，拆树时摘掉 */
  setDeskOps(ops: DeskOps | undefined): void
  deskOps(): DeskOps | undefined
  /**
   * 所有桌面上开着的窗格，按桌面顺序：挂着的从活井摘，没挂过的从落盘布局读。桌面清单缺省问注入的
   * 桌面操作；开机那一下井的 onReady 比注入早，那时由调用方把清单递进来
   */
  entries(rows?: readonly DesktopRow[]): PaneEntry[]
}

/** dockview 组上本模块要看的那一点形状 */
interface GroupLike {
  id: string
  panels: readonly (PanelLike & { id: string; title?: string })[]
  activePanel?: { id: string } | undefined
  element: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } }
}

/** 活井 → 清单里的那几行 */
function liveEntries(desktop: string, api: DockviewApi): PaneEntry[] {
  const out: PaneEntry[] = []
  for (const group of groupsOf(api)) {
    for (const panel of group.panels) {
      const row = entryOf(
        desktop,
        group.id,
        { id: panel.id, ...(panel.title === undefined ? {} : { title: panel.title }), ...(panel.params === undefined ? {} : { params: panel.params }) },
        group.activePanel?.id === panel.id,
      )
      if (row !== undefined) out.push(row)
    }
  }
  return out
}

/** 一组 → 快照里的一组。矩形取页面坐标：藏起来的桌面是 visibility:hidden，照样有布局 */
function deskGroupOf(group: GroupLike): DeskGroup {
  const r = group.element.getBoundingClientRect()
  const active = group.activePanel?.id
  return {
    id: group.id,
    tabs: group.panels.map((panel) => ({
      id: panel.id,
      entryId: entryIdOf(panel),
      paneId: paneIdOf(panel),
      key: paneKeyOf(panel),
      preview: isPreviewPanel(panel),
    })),
    ...(active === undefined ? {} : { active }),
    box: { x: r.left, y: r.top, w: r.width, h: r.height },
  }
}

function groupsOf(api: DockviewApi): readonly GroupLike[] {
  return api.groups as unknown as readonly GroupLike[]
}

export function createWellHub(): WellHub {
  let currentHost: HostBridge | undefined
  const wells = new Map<string, DockviewApi>()
  /** 每张桌面的组激活顺序，最近的在前 */
  const recent = new Map<string, string[]>()
  /** 最近取到的注册表里每一格的 kind，键是 `entryId\npaneId` */
  const kinds = new Map<string, PaneKind>()
  let active = ''
  let flush: (() => void) | undefined
  let ops: DeskOps | undefined

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
      wells.set(desktopId, api)
    },
    removeWell(desktopId) {
      wells.delete(desktopId)
      recent.delete(desktopId)
    },
    wells() {
      return wells
    },
    clearWells() {
      wells.clear()
      recent.clear()
      active = ''
    },
    activeDesktop() {
      return active
    },
    setActiveDesktop(desktopId) {
      active = desktopId
    },
    setFlusher(fn) {
      flush = fn
    },
    flush() {
      flush?.()
    },
    deskOf(desktopId) {
      const api = wells.get(desktopId)
      if (api === undefined) return undefined
      const activeGroup = api.activeGroup?.id
      return {
        groups: groupsOf(api).map(deskGroupOf),
        ...(activeGroup === undefined ? {} : { activeGroup }),
        recent: recent.get(desktopId) ?? [],
      }
    },
    locate(panelId) {
      for (const [desktop, api] of wells) {
        if (api.getPanel(panelId) !== undefined) return desktop
      }
      return undefined
    },
    noteActiveGroup(desktopId, groupId) {
      const api = wells.get(desktopId)
      const alive = new Set(api === undefined ? [] : groupsOf(api).map((g) => g.id))
      // 已经没了的组顺手摘掉：账只装活着的组，不会越记越长
      const rest = (recent.get(desktopId) ?? []).filter((id) => id !== groupId && alive.has(id))
      recent.set(desktopId, [groupId, ...rest])
    },
    takenAnywhere(panelId) {
      for (const api of wells.values()) {
        if (api.getPanel(panelId) !== undefined) return true
      }
      return false
    },
    notePanes(rows) {
      kinds.clear()
      // 换行符不会出现在条目 id 与窗格 id 里，拿它拼键不会撞
      for (const row of rows) kinds.set(`${row.entryId}\n${row.id}`, row.kind)
    },
    paneKind(entryId, paneId) {
      return kinds.get(`${entryId}\n${paneId}`) ?? 'tool'
    },
    setDeskOps(next) {
      ops = next
    },
    deskOps() {
      return ops
    },
    entries(rows = ops?.rows()) {
      if (rows === undefined) return []
      return rows.flatMap((row) => {
        const api = wells.get(row.id)
        return api === undefined ? entriesOfLayout(row.id, row.layout) : liveEntries(row.id, api)
      })
    },
  }
}

/** 一页只有一份外壳，枢纽跟着只有一份。组件表够不着 App 的闭包，都从这儿过 */
export const wellHub: WellHub = createWellHub()
