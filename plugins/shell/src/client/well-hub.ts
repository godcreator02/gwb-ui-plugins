import type { DockviewApi } from 'dockview-react'
import { entryIdOf, isPreviewPanel, paneIdOf, paneKeyOf } from '../panels.js'
import type { OpenPane } from '../openable.js'
import type { HostBridge } from './types.js'

/**
 * 全井枢纽：井注册表、活动桌面、切桌分派、落盘钩子、命令口——外壳浏览器半的全部
 * 页面级状态，收在一个有声明接口的对象里。
 *
 * **为什么是模块级单例而不是 React 状态**：内核那条命令口存在模块级而不是经 params 传
 * （面板组件表必须是模块级常量——换引用会让 dockview 重建全部格，组件因此拿不到
 * `bootShell` 的闭包；而塞进 `params` 会跟着布局一起落盘）。同一个理由管着这里的每一样。
 * 它们以前是五个散装模块变量加注释里的时序约定，如今有名字、有接口，约定归在两处：
 *
 * - `setActiveDesktop` **当场生效（同拍）**：`switchTo` 先改它再改 React 状态，
 *   跨井聚焦的分派在同一拍里看到的就是新值
 * - **桌面是分组不是宇宙**（0.4.0）：实例 id 全页唯一，查重看全井聚合
 *   （`takenAnywhere`）；同一格开在别的桌面的份带 `here: false`（`openInstances`）
 *
 * 对 dockview 只用到 `getPanel` / `panels`，测试里喂假井就能跑；零 DOM、零 react。
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
  /** App 卸载那趟：井全拆、活动桌面归零 */
  clearWells(): void
  /** 活动桌面 id */
  activeDesktop(): string
  setActiveDesktop(desktopId: string): void
  /** 跨井聚焦落在别的井时，由它把那口井切到台前（App 注入 `switchTo`） */
  setSwitcher(switchTo: ((desktopId: string) => void) | undefined): void
  switcher(): ((desktopId: string) => void) | undefined
  /** 拆树前抢一把落盘的钩子（App 注入 `flushSave`），bootShell 的 dispose 扳它 */
  setFlusher(flush: (() => void) | undefined): void
  flush(): void
  /** 这一格此刻开着的几份——全井聚合，别桌的份带 `here: false` */
  openInstances(who: { entryId: string; paneId: string }): OpenPane[]
  /** 这个 id 在任何一口井里已经有格了吗 */
  takenAnywhere(panelId: string): boolean
}

export function createWellHub(): WellHub {
  let currentHost: HostBridge | undefined
  const wells = new Map<string, DockviewApi>()
  let active = ''
  let switchTo: ((desktopId: string) => void) | undefined
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
      active = ''
    },
    activeDesktop() {
      return active
    },
    setActiveDesktop(desktopId) {
      active = desktopId
    },
    setSwitcher(next) {
      switchTo = next
    },
    switcher() {
      return switchTo
    },
    setFlusher(fn) {
      flush = fn
    },
    flush() {
      flush?.()
    },
    openInstances(who) {
      const out: OpenPane[] = []
      for (const [desktop, api] of wells) {
        for (const panel of api.panels) {
          if (entryIdOf(panel) !== who.entryId || paneIdOf(panel) !== who.paneId) continue
          out.push({
            id: panel.id,
            key: paneKeyOf(panel),
            preview: isPreviewPanel(panel),
            ...(desktop === active ? {} : { here: false as const }),
          })
        }
      }
      return out
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
