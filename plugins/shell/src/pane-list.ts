import { PLUGIN_COMPONENT } from './panels.js'

/** 窗格清单里的一行：「桌面」面板列它，`shell.pane.list` 回它 */
export interface PaneEntry {
  /** 实例 id（`pane.instance`），全页唯一 */
  instance: string
  desktop: string
  /** dockview 的 group id，桌面内唯一 */
  group: string
  pkg: string
  entryId: string
  paneId: string
  /** 此刻装的内容，上报过就是上报的那个 */
  key: string
  title: string
  icon?: string
  preview: boolean
  /** 是不是那一组的活动标签 */
  active: boolean
}

/** 正在运行的容器里的面板与布局文件里的面板都能整理成这个形状 */
export interface PanelView {
  id: string
  title?: string
  params?: Record<string, unknown>
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** params 缺外壳的身份字段（不是插件窗格）回 undefined */
export function entryOf(desktop: string, group: string, panel: PanelView, active: boolean): PaneEntry | undefined {
  const params = panel.params ?? {}
  const pkg = stringOrUndefined(params.pluginKey)
  const entryId = stringOrUndefined(params.entryId)
  const paneId = stringOrUndefined(params.paneId)
  if (pkg === undefined || entryId === undefined || paneId === undefined) return undefined
  const icon = stringOrUndefined(params.icon)
  return {
    instance: panel.id,
    desktop,
    group,
    pkg,
    entryId,
    paneId,
    key: stringOrUndefined(params.key) ?? '',
    title: panel.title ?? panel.id,
    ...(icon === undefined ? {} : { icon }),
    preview: params.preview === true,
    active,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

interface SavedGroup {
  id: string
  views: string[]
  activeView?: string
}

/** 布局文件里 grid 的叶子（组），深度优先 */
function collectSavedGroups(node: unknown, savedGroups: SavedGroup[]): void {
  if (!isObject(node)) return
  if (node.type === 'leaf' && isObject(node.data)) {
    const views = Array.isArray(node.data.views) ? node.data.views.filter((view): view is string => typeof view === 'string') : []
    const id = stringOrUndefined(node.data.id) ?? ''
    const activeView = stringOrUndefined(node.data.activeView)
    savedGroups.push({ id, views, ...(activeView === undefined ? {} : { activeView }) })
    return
  }
  if (node.type === 'branch' && Array.isArray(node.data)) for (const child of node.data) collectSavedGroups(child, savedGroups)
}

/**
 * 没挂载过的桌面：从它保存的 dockview `toJSON()` 里读出开着的窗格。只读 grid 的叶子与 panels 表，
 * 认不出的一律跳过——清单少一行好过「桌面」面板整个打不开
 */
export function entriesOfLayout(desktop: string, layout: Record<string, unknown> | null): PaneEntry[] {
  if (layout === null || !isObject(layout.grid) || !isObject(layout.panels)) return []
  const savedPanels = layout.panels
  const savedGroups: SavedGroup[] = []
  collectSavedGroups(layout.grid.root, savedGroups)
  const entries: PaneEntry[] = []
  for (const savedGroup of savedGroups) {
    for (const panelId of savedGroup.views) {
      const savedPanel = savedPanels[panelId]
      if (!isObject(savedPanel) || savedPanel.contentComponent !== PLUGIN_COMPONENT) continue
      const title = stringOrUndefined(savedPanel.title)
      const entry = entryOf(
        desktop,
        savedGroup.id,
        { id: panelId, ...(title === undefined ? {} : { title }), ...(isObject(savedPanel.params) ? { params: savedPanel.params } : {}) },
        savedGroup.activeView === panelId,
      )
      if (entry !== undefined) entries.push(entry)
    }
  }
  return entries
}

/** 「关闭其他」「关闭右侧」要关哪几个；自己已不在这一组（菜单开着时被拖走了）就什么都不关 */
export function tabsToClose(order: readonly string[], self: string, which: 'others' | 'right'): string[] {
  const selfIndex = order.indexOf(self)
  if (selfIndex < 0) return []
  return which === 'others' ? order.filter((id) => id !== self) : order.slice(selfIndex + 1)
}

/** 「桌面」面板里的一段：一张桌面与它上面的窗格 */
export interface DeskSection {
  desktop: string
  name: string
  current: boolean
  rows: PaneEntry[]
}

/** 照桌面本来的顺序，不把当前那张提前；空桌面也列出来，窗格要能拖上去 */
export function desktopSections(
  desktops: readonly { id: string; name: string }[],
  current: string,
  rows: readonly PaneEntry[],
): DeskSection[] {
  return desktops.map((desktop) => ({
    desktop: desktop.id,
    name: desktop.name,
    current: desktop.id === current,
    rows: rows.filter((row) => row.desktop === desktop.id),
  }))
}

/** 放回它本来那张不接，认不出它在哪张不接；当前桌面照接，那就是拉到本桌 */
export function acceptsDrop(from: string | undefined, to: string): boolean {
  return from !== undefined && from !== to
}
