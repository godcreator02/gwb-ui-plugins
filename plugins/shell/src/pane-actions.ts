import type { PaneKind } from './pane-registry.js'
import type { PaneEntry } from './pane-list.js'

/** node 侧经内核事件入口转给页面的窗格动作事件上的标记 */
export const PANE_EVENT = 'gwb-shell-pane'

export type PaneAction =
  /** 激活它；在别的桌面就切过去 */
  | { t: typeof PANE_EVENT; action: 'focus'; instance: string }
  /** 关掉它，插件照常 dispose，不切桌面 */
  | { t: typeof PANE_EVENT; action: 'close'; instance: string }
  /** `desktop`（已有桌面的 id）与 `newDesktop`（新桌面的名字，空串用缺省名）给一个；`follow` 送完跟过去 */
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

type ParsedPaneArgs = { ok: true; action: PaneAction } | { ok: false; error: string }

function sendTargetOf(args: PaneActionLike, sendsToExistingDesktop: boolean): { desktop: string } | { newDesktop: string } {
  if (sendsToExistingDesktop) return { desktop: args.desktop as string }
  return { newDesktop: typeof args.newDesktop === 'string' ? args.newDesktop.trim() : '' }
}

/** 命令参数 → 转给页面的动作；认不出回 error，调用方原样回给命令总线 */
export function parsePaneArgs(action: 'focus' | 'close' | 'send', args: unknown): ParsedPaneArgs {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, error: `参数得是对象：{ instance${action === 'send' ? ', desktop? | newDesktop?, follow?' : ''} }` }
  }
  const paneArgs = args as PaneActionLike
  if (typeof paneArgs.instance !== 'string' || paneArgs.instance === '') {
    return { ok: false, error: 'instance 是窗格的实例 id（shell.pane.list 回的那一项、插件手上的 pane.instance）' }
  }
  if (action !== 'send') return { ok: true, action: { t: PANE_EVENT, action, instance: paneArgs.instance } }
  const sendsToExistingDesktop = typeof paneArgs.desktop === 'string' && paneArgs.desktop !== ''
  const sendsToNewDesktop = typeof paneArgs.newDesktop === 'string' || paneArgs.newDesktop === true
  if (sendsToExistingDesktop === sendsToNewDesktop) {
    return { ok: false, error: 'desktop（已有桌面的 id）与 newDesktop（新桌面的名字，true 或空串用缺省名）给且只给一个' }
  }
  if (paneArgs.follow !== undefined && typeof paneArgs.follow !== 'boolean') return { ok: false, error: 'follow 是布尔（true = 送完跟过去）' }
  return {
    ok: true,
    action: {
      t: PANE_EVENT,
      action: 'send',
      instance: paneArgs.instance,
      ...sendTargetOf(paneArgs, sendsToExistingDesktop),
      ...(paneArgs.follow === true ? { follow: true } : {}),
    },
  }
}

/** 页面推给 node 侧缓存的：所有桌面上开着的窗格、桌面清单、当前桌面 */
export interface PaneSync {
  entries: PaneEntry[]
  desktops: { id: string; name: string }[]
  active: string
}

const PANE_ENTRY_STRING_FIELDS = ['instance', 'desktop', 'group', 'pkg', 'entryId', 'paneId', 'key', 'title']

function isPaneEntry(value: unknown): value is PaneEntry {
  if (value === null || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    PANE_ENTRY_STRING_FIELDS.every((field) => typeof entry[field] === 'string') &&
    typeof entry.preview === 'boolean' &&
    typeof entry.active === 'boolean'
  )
}

/** 认不出回 undefined，node 侧缓存保持上一份 */
export function parsePaneSync(raw: unknown): PaneSync | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const pushed = raw as { entries?: unknown; desktops?: unknown; active?: unknown }
  if (!Array.isArray(pushed.entries) || !pushed.entries.every(isPaneEntry)) return undefined
  if (!Array.isArray(pushed.desktops) || !pushed.desktops.every((desktop) => typeof desktop?.id === 'string' && typeof desktop?.name === 'string')) return undefined
  if (typeof pushed.active !== 'string') return undefined
  return { entries: pushed.entries, desktops: pushed.desktops as PaneSync['desktops'], active: pushed.active }
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

/** `kind` 问注册表，插件卸载了就是 tool */
export function listRowsOf(entries: readonly PaneEntry[], kindOf: (entryId: string, paneId: string) => PaneKind): PaneListRow[] {
  return entries.map((entry) => ({
    instance: entry.instance,
    desktop: entry.desktop,
    group: entry.group,
    pkg: entry.pkg,
    entryId: entry.entryId,
    paneId: entry.paneId,
    kind: kindOf(entry.entryId, entry.paneId),
    key: entry.key,
    title: entry.title,
    preview: entry.preview,
    active: entry.active,
  }))
}
