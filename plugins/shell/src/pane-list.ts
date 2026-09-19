import { PLUGIN_COMPONENT } from './panels.js'

/**
 * 窗格清单：「此刻开着哪些窗格」的一行一个形状。切换器（状态栏「窗格」）列它，`shell.pane.list`
 * 回它。挂着的桌面从活井现摘，**没挂过的桌面从落盘的那份布局里读**（开机只挂活动那张，别的
 * 桌面没切去过就没有井）。纯模块，两半共用，node 里直接测。
 */

/** 清单里的一行 */
export interface PaneEntry {
  /** 这一份的实例 id（`pane.instance`），全页唯一 */
  instance: string
  desktop: string
  /** 它在哪一组（dockview 的 group id，桌面内唯一） */
  group: string
  pkg: string
  entryId: string
  paneId: string
  /** 此刻装的内容（上报过就是上报的那个） */
  key: string
  title: string
  icon?: string
  preview: boolean
  /** 它是不是那一组的活动标签 */
  active: boolean
}

/** 一份面板在本模块眼里的样子：活井里的面板与落盘的面板都摆得成这样 */
export interface PanelView {
  id: string
  title?: string
  params?: Record<string, unknown>
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** 一份面板 → 一行。不是插件窗格（params 缺识别三件套）回 undefined */
export function entryOf(desktop: string, group: string, panel: PanelView, active: boolean): PaneEntry | undefined {
  const p = panel.params ?? {}
  const pkg = str(p.pluginKey)
  const entryId = str(p.entryId)
  const paneId = str(p.paneId)
  if (pkg === undefined || entryId === undefined || paneId === undefined) return undefined
  const icon = str(p.icon)
  return {
    instance: panel.id,
    desktop,
    group,
    pkg,
    entryId,
    paneId,
    key: str(p.key) ?? '',
    title: panel.title ?? panel.id,
    ...(icon === undefined ? {} : { icon }),
    preview: p.preview === true,
    active,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 落盘布局里的组（grid 的叶子），按深度优先的顺序 */
function leavesOf(node: unknown, out: { id: string; views: string[]; activeView?: string }[]): void {
  if (!isObject(node)) return
  if (node.type === 'leaf' && isObject(node.data)) {
    const views = Array.isArray(node.data.views) ? node.data.views.filter((v): v is string => typeof v === 'string') : []
    const id = str(node.data.id) ?? ''
    const activeView = str(node.data.activeView)
    out.push({ id, views, ...(activeView === undefined ? {} : { activeView }) })
    return
  }
  if (node.type === 'branch' && Array.isArray(node.data)) for (const child of node.data) leavesOf(child, out)
}

/**
 * 没挂过的桌面：从它落盘的那份 dockview `toJSON()` 里读出开着的窗格。形状归 dockview，这儿只读
 * 用得着的几格（grid 的叶子与 panels 表），认不出的一律略过——清单少一行比切换器整个打不开强。
 */
export function entriesOfLayout(desktop: string, layout: Record<string, unknown> | null): PaneEntry[] {
  if (layout === null || !isObject(layout.grid) || !isObject(layout.panels)) return []
  const panels = layout.panels
  const leaves: { id: string; views: string[]; activeView?: string }[] = []
  leavesOf(layout.grid.root, leaves)
  const rows: PaneEntry[] = []
  for (const leaf of leaves) {
    for (const id of leaf.views) {
      const raw = panels[id]
      if (!isObject(raw) || raw.contentComponent !== PLUGIN_COMPONENT) continue
      const title = str(raw.title)
      const row = entryOf(
        desktop,
        leaf.id,
        { id, ...(title === undefined ? {} : { title }), ...(isObject(raw.params) ? { params: raw.params } : {}) },
        leaf.activeView === id,
      )
      if (row !== undefined) rows.push(row)
    }
  }
  return rows
}

/**
 * 标签菜单「关闭其他」「关闭右侧」要关哪几个：`order` 是这一组的标签顺序。自己不在这一组
 * （菜单开着时被拖走了）就什么都不关——关错别人的标签比少关一个难收拾得多。
 */
export function tabsToClose(order: readonly string[], self: string, which: 'others' | 'right'): string[] {
  const at = order.indexOf(self)
  if (at < 0) return []
  return which === 'others' ? order.filter((id) => id !== self) : order.slice(at + 1)
}

/** 切换器里的一段：一张桌面与它上面的窗格 */
export interface SwitcherGroup {
  desktop: string
  name: string
  current: boolean
  rows: PaneEntry[]
}

/** 按桌面分段：当前桌面在最前、标「当前」，其余照桌面顺序；空桌面也列出来（送到那张要用得着它） */
export function orderForSwitcher(
  desktops: readonly { id: string; name: string }[],
  current: string,
  rows: readonly PaneEntry[],
): SwitcherGroup[] {
  const groups = desktops.map((d) => ({
    desktop: d.id,
    name: d.name,
    current: d.id === current,
    rows: rows.filter((r) => r.desktop === d.id),
  }))
  return [...groups.filter((g) => g.current), ...groups.filter((g) => !g.current)]
}
