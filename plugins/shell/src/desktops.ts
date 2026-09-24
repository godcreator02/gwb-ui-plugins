import type { DesktopRow } from './layout.js'

/** node 侧经内核事件入口转给页面的桌面动作事件上的标记 */
export const DESKTOP_EVENT = 'gwb-shell-desktop'

/** 回执 ok 只代表转发了，不代表页面已经执行完 */
export type DesktopAction =
  | { t: typeof DESKTOP_EVENT; action: 'switch'; id?: string; name?: string }
  | { t: typeof DESKTOP_EVENT; action: 'new'; name?: string }
  | { t: typeof DESKTOP_EVENT; action: 'rename'; id: string; name: string }
  /** 上面的窗格一起关掉；不弹确认，调用方已经决定了 */
  | { t: typeof DESKTOP_EVENT; action: 'delete'; id: string }

/** 事件入口上什么插件的事件都有：认出标记之后再按这个形状收窄 */
export interface DesktopActionLike {
  t?: unknown
  action?: unknown
  id?: unknown
  name?: unknown
}

export function isDesktopAction(payload: unknown): payload is DesktopActionLike {
  if (payload === null || typeof payload !== 'object') return false
  return (payload as DesktopActionLike).t === DESKTOP_EVENT
}

/**
 * id 优先；按名字找时重名取第一张。id 与 name 都不是非空字符串回 undefined，调用方什么都不做
 */
export function resolveDesktop(
  desktops: readonly DesktopRow[],
  by: { id?: unknown; name?: unknown },
): DesktopRow | undefined {
  if (typeof by.id === 'string' && by.id !== '') return desktops.find((desktop) => desktop.id === by.id)
  if (typeof by.name === 'string' && by.name !== '') return desktops.find((desktop) => desktop.name === by.name)
  return undefined
}

/** d3 → 「桌面 3」 */
export function defaultDesktopName(id: string): string {
  return `桌面 ${id.replace(/^d/, '')}`
}

/** 名字去两头空白；空名或认不出的 id 回 undefined，什么都不改 */
export function renameDesktop(desktops: readonly DesktopRow[], id: string, name: string): DesktopRow[] | undefined {
  const trimmedName = name.trim()
  if (trimmedName === '' || !desktops.some((desktop) => desktop.id === id)) return undefined
  return desktops.map((desktop) => (desktop.id === id ? { ...desktop, name: trimmedName } : desktop))
}

/**
 * 删掉当前桌面之后切到哪张：左边相邻那张，删的是最左边那张就右边那张。
 * 只剩一张或认不出的 id 回 undefined
 */
export function afterDelete(desktops: readonly DesktopRow[], id: string): string | undefined {
  const deletedIndex = desktops.findIndex((desktop) => desktop.id === id)
  if (deletedIndex < 0 || desktops.length < 2) return undefined
  return (deletedIndex > 0 ? desktops[deletedIndex - 1] : desktops[deletedIndex + 1])?.id
}

/** 空桌面也确认；上面有窗格就写明会一起关掉几个 */
export function deleteConfirmText(name: string, panes: number): { title: string; description: string } {
  return {
    title: `删除『${name}』？`,
    description: panes > 0 ? `上面 ${String(panes)} 个窗格会一起关掉。` : '这张桌面是空的。',
  }
}

function asArgsObject(args: unknown): { id?: unknown; name?: unknown } | undefined {
  return args !== null && typeof args === 'object' && !Array.isArray(args) ? (args as { id?: unknown; name?: unknown }) : undefined
}

export function parseRenameArgs(args: unknown): { ok: true; id: string; name: string } | { ok: false; error: string } {
  const argsObject = asArgsObject(args)
  if (typeof argsObject?.id !== 'string' || argsObject.id === '') return { ok: false, error: '参数 { id, name }：id 是桌面 id（用 shell.desktop.list 查）' }
  if (typeof argsObject.name !== 'string' || argsObject.name.trim() === '') return { ok: false, error: 'name 得是非空字符串——空名不改' }
  return { ok: true, id: argsObject.id, name: argsObject.name.trim() }
}

export function parseDeleteArgs(args: unknown): { ok: true; id: string } | { ok: false; error: string } {
  const argsObject = asArgsObject(args)
  if (typeof argsObject?.id !== 'string' || argsObject.id === '') return { ok: false, error: '参数 { id }：id 是桌面 id（用 shell.desktop.list 查）' }
  return { ok: true, id: argsObject.id }
}
