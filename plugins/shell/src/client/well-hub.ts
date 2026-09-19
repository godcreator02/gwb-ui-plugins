import type { DockviewApi } from 'dockview-react'
import { entryIdOf, isPreviewPanel, paneIdOf, paneKeyOf, type PanelLike } from '../panels.js'
import type { Desk, DeskGroup } from '../openable.js'
import type { HostBridge } from './types.js'

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
}

/** dockview 组上本模块要看的那一点形状 */
interface GroupLike {
  id: string
  panels: readonly (PanelLike & { id: string })[]
  activePanel?: { id: string } | undefined
  element: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } }
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
  let active = ''
  let flush: (() => void) | undefined

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
  }
}

/** 一页只有一份外壳，枢纽跟着只有一份。组件表够不着 App 的闭包，都从这儿过 */
export const wellHub: WellHub = createWellHub()
