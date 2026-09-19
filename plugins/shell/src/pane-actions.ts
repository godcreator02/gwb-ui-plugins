import type { PaneKind } from './pane-registry.js'
import type { PaneEntry } from './pane-list.js'

/**
 * 窗格命令那半的纯判断：`shell.pane.focus / send / close` 转给页面的动作长什么样、参数怎么认；
 * 页面推给 node 半缓存的清单（`shell.pane.sync`）怎么认；`shell.pane.list` 回的那几行。
 *
 * **容器在页面那半**：这几条命令跟桌面那几条同一种转发——node 半验完参数、经内核事件口转进去，
 * 回执只代表「转发了」。只读的 `list` 读页面推来的缓存。纯模块，两半共用，node 里直接测。
 */

/** node → 页面那条窗格动作事件上的记号 */
export const PANE_EVENT = 'gwb-shell-pane'

export type PaneAction =
  /** 激活它；在别的桌面就切过去（显式切换） */
  | { t: typeof PANE_EVENT; action: 'focus'; instance: string }
  /** 关掉它，插件照常 dispose，不切桌面 */
  | { t: typeof PANE_EVENT; action: 'close'; instance: string }
  /**
   * 送到别的桌面：`desktop`（已有桌面的 id）与 `newDesktop`（新桌面的名字，空串用缺省名）给一个；
   * `follow` 送完跟过去，不给就留在当前桌面
   */
  | { t: typeof PANE_EVENT; action: 'send'; instance: string; desktop?: string; newDesktop?: string; follow?: true }

/** 事件载荷的宽松形状 */
export interface PaneActionLike {
  t?: unknown
  action?: unknown
  instance?: unknown
  desktop?: unknown
  newDesktop?: unknown
  follow?: unknown
}

export function isPaneAction(payload: unknown): payload is PaneActionLike {
  if (payload === null || typeof payload !== 'object') return false
  return (payload as PaneActionLike).t === PANE_EVENT
}

type Parsed = { ok: true; action: PaneAction } | { ok: false; error: string }

/** 总线参数 → 转给页面的动作。认不出回 error，调用方原样回给总线 */
export function parsePaneArgs(action: 'focus' | 'close' | 'send', args: unknown): Parsed {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, error: `参数得是对象：{ instance${action === 'send' ? ', desktop? | newDesktop?, follow?' : ''} }` }
  }
  const a = args as PaneActionLike
  if (typeof a.instance !== 'string' || a.instance === '') {
    return { ok: false, error: 'instance 是窗格的实例 id（shell.pane.list 回的那一格、件手上的 pane.instance）' }
  }
  if (action !== 'send') return { ok: true, action: { t: PANE_EVENT, action, instance: a.instance } }
  const hasDesk = typeof a.desktop === 'string' && a.desktop !== ''
  const hasNew = typeof a.newDesktop === 'string' || a.newDesktop === true
  if (hasDesk === hasNew) {
    return { ok: false, error: 'desktop（已有桌面的 id）与 newDesktop（新桌面的名字，true 或空串用缺省名）给且只给一个' }
  }
  if (a.follow !== undefined && typeof a.follow !== 'boolean') return { ok: false, error: 'follow 是布尔（true = 送完跟过去）' }
  return {
    ok: true,
    action: {
      t: PANE_EVENT,
      action: 'send',
      instance: a.instance,
      ...(hasDesk ? { desktop: a.desktop as string } : { newDesktop: typeof a.newDesktop === 'string' ? a.newDesktop.trim() : '' }),
      ...(a.follow === true ? { follow: true } : {}),
    },
  }
}

/** 页面推给 node 半的那一份：所有桌面上开着的窗格、桌面清单、当前桌面 */
export interface PaneSync {
  entries: PaneEntry[]
  desktops: { id: string; name: string }[]
  active: string
}

function isEntry(value: unknown): value is PaneEntry {
  if (value === null || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return (
    ['instance', 'desktop', 'group', 'pkg', 'entryId', 'paneId', 'key', 'title'].every((k) => typeof e[k] === 'string') &&
    typeof e.preview === 'boolean' &&
    typeof e.active === 'boolean'
  )
}

/** 推来的东西认得出才收；认不出回 undefined，node 半的缓存保持上一份 */
export function parsePaneSync(raw: unknown): PaneSync | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const s = raw as { entries?: unknown; desktops?: unknown; active?: unknown }
  if (!Array.isArray(s.entries) || !s.entries.every(isEntry)) return undefined
  if (!Array.isArray(s.desktops) || !s.desktops.every((d) => typeof d?.id === 'string' && typeof d?.name === 'string')) return undefined
  if (typeof s.active !== 'string') return undefined
  return { entries: s.entries, desktops: s.desktops as PaneSync['desktops'], active: s.active }
}

/** `shell.pane.list` 回的一行 */
export interface PaneListRow {
  instance: string
  desktop: string
  group: string
  pkg: string
  entryId: string
  paneId: string
  kind: PaneKind
  key: string
  title: string
  preview: boolean
  active: boolean
}

/** 缓存里的清单 → 回执那几行，`kind` 问注册表（件卸了就是 tool） */
export function listRowsOf(entries: readonly PaneEntry[], kindOf: (entryId: string, paneId: string) => PaneKind): PaneListRow[] {
  return entries.map((e) => ({
    instance: e.instance,
    desktop: e.desktop,
    group: e.group,
    pkg: e.pkg,
    entryId: e.entryId,
    paneId: e.paneId,
    kind: kindOf(e.entryId, e.paneId),
    key: e.key,
    title: e.title,
    preview: e.preview,
    active: e.active,
  }))
}
