import type { DesktopRow } from './layout.js'

/**
 * 桌面那半的纯判断：命令面（`shell.desktop.*`）转进来的动作怎么落到桌面条目上。
 *
 * 纯机、无 DOM，node 半与浏览器半共用这一份，测试在 node 里直接跑。
 */

/** node → 页面那条桌面动作事件上的记号。载荷形状就是 `DesktopAction` */
export const DESKTOP_EVENT = 'gwb-shell-desktop'

/**
 * 页面上执行得了的两条动作。**井在页面那半**，node 半的命令只是把动作经内核事件口
 * 转进去；命令回执只代表「转发了」，不代表「切完了」。
 */
export type DesktopAction =
  | { t: typeof DESKTOP_EVENT; action: 'switch'; id?: string; name?: string }
  | { t: typeof DESKTOP_EVENT; action: 'new'; name?: string }
  | { t: typeof DESKTOP_EVENT; action: 'rename'; id: string; name: string }
  /** 删掉一张桌面，上面的窗格一起关掉（命令不弹确认——调用方已经决定了） */
  | { t: typeof DESKTOP_EVENT; action: 'delete'; id: string }

/** 事件载荷的宽松形状：事件口上什么件的事件都有，认了自己那记号再按这个收窄 */
export interface DesktopActionLike {
  t?: unknown
  action?: unknown
  id?: unknown
  name?: unknown
}

/** 是不是一条桌面动作（记号对得上）。事件监听那侧的第一道过滤 */
export function isDesktopAction(payload: unknown): payload is DesktopActionLike {
  if (payload === null || typeof payload !== 'object') return false
  return (payload as DesktopActionLike).t === DESKTOP_EVENT
}

/**
 * 按 id 或名字找那口桌面。**id 优先**：名字不唯一（id 才是身份），名字撞了取第一口
 * ——「叫这个名的里面随便哪口」就是按名字切的语义，报错反而没道理。
 *
 * id / name 都不是非空字符串 → undefined，调用方什么都不做（agent 手滑不该在井里
 * 留下任何动静）。
 */
export function resolveDesktop(
  desktops: readonly DesktopRow[],
  by: { id?: unknown; name?: unknown },
): DesktopRow | undefined {
  if (typeof by.id === 'string' && by.id !== '') return desktops.find((d) => d.id === by.id)
  if (typeof by.name === 'string' && by.name !== '') return desktops.find((d) => d.name === by.name)
  return undefined
}

/** 新桌面的缺省名：跟 id 的号走（d3 → 「桌面 3」） */
export function defaultDesktopName(id: string): string {
  return `桌面 ${id.replace(/^d/, '')}`
}

/** 改名：按 id 改、名字去两头空白。空名或认不出的 id 回 undefined——什么都不改 */
export function renameDesktop(desktops: readonly DesktopRow[], id: string, name: string): DesktopRow[] | undefined {
  const trimmed = name.trim()
  if (trimmed === '' || !desktops.some((d) => d.id === id)) return undefined
  return desktops.map((d) => (d.id === id ? { ...d, name: trimmed } : d))
}

/**
 * 删掉这张之后该切到哪张（删的是当前桌面时用）：左边相邻那张，删的是最左边那张就右边那张。
 * 只剩一张（删不了）或认不出的 id 回 undefined
 */
export function afterDelete(desktops: readonly DesktopRow[], id: string): string | undefined {
  const at = desktops.findIndex((d) => d.id === id)
  if (at < 0 || desktops.length < 2) return undefined
  return (at > 0 ? desktops[at - 1] : desktops[at + 1])?.id
}

/**
 * 删桌面的确认框写什么。**一律确认**（空桌面也确认，人定的）；上面有窗格就点名会一起关掉几个——
 * 那一摊是不回来的，框里得说清楚
 */
export function deleteConfirmText(name: string, panes: number): { title: string; description: string } {
  return {
    title: `删除『${name}』？`,
    description: panes > 0 ? `上面 ${String(panes)} 个窗格会一起关掉。` : '这张桌面是空的。',
  }
}

function argsObject(args: unknown): { id?: unknown; name?: unknown } | undefined {
  return args !== null && typeof args === 'object' && !Array.isArray(args) ? (args as { id?: unknown; name?: unknown }) : undefined
}

/** `shell.desktop.rename` 的参数：id 与非空名字 */
export function parseRenameArgs(args: unknown): { ok: true; id: string; name: string } | { ok: false; error: string } {
  const a = argsObject(args)
  if (typeof a?.id !== 'string' || a.id === '') return { ok: false, error: '参数 { id, name }：id 是桌面 id（shell.desktop.list 现查）' }
  if (typeof a.name !== 'string' || a.name.trim() === '') return { ok: false, error: 'name 得是非空字符串——空名不改' }
  return { ok: true, id: a.id, name: a.name.trim() }
}

/** `shell.desktop.delete` 的参数：id */
export function parseDeleteArgs(args: unknown): { ok: true; id: string } | { ok: false; error: string } {
  const a = argsObject(args)
  if (typeof a?.id !== 'string' || a.id === '') return { ok: false, error: '参数 { id }：id 是桌面 id（shell.desktop.list 现查）' }
  return { ok: true, id: a.id }
}
