/**
 * 「可装」那一栏的纯逻辑：检索结果与已装列表的对照、搜索框的本地筛选、汇总。
 * 不碰 DOM、**也不碰网络**——检索由主进程里的 gwb-plugin-sources（`plugin-sources.search`）做，这里只管拿到结果之后的事。
 *
 * **不 import 主进程插件的类型**：检索结果经 IPC 传过来，本来就要当 `unknown` 收窄一次；
 * gwb-plugin-sources 的 `search.ts` 里有一份同样形状的 `SearchRow`，两边各写各的（和 `rows.ts` 对
 * `PackageView` 的做法一样）。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 一条检索结果经 IPC 传过来之后的样子。和 gwb-plugin-sources `search.ts` 的 `SearchRow` 是同一个形状 */
export interface SearchRow {
  pkg: string
  /** registry 上的最新版 */
  version?: string
  /** registry 上的一句话 */
  description?: string
}

/** 包名里的 scope：`@j/gwb-x` → `@j`；没有 scope 的包名返回空串。每行的来源标签由它得出 */
export function scopeOf(pkg: string): string {
  if (!pkg.startsWith('@')) return ''
  const cut = pkg.indexOf('/')
  return cut === -1 ? '' : pkg.slice(0, cut)
}

/** 按源筛选的一项：scope 和这个源在列表里的插件数 */
export interface ScopeOption {
  scope: string
  count: number
}

/**
 * 从**当前已加载的行**算出按源筛选的选项——列表里有什么源就列什么源，一个插件都没有的源不列；
 * 顺序按第一次出现的先后（检索回执本来就是 @godcreator 在前、其余按名字排），不再另外排序。
 * 不去问 `plugin-sources.list`：筛选项跟着眼前的列表走，比跟着配置走更准确。
 */
export function scopeOptions(packages: readonly SearchRow[]): ScopeOption[] {
  const order: string[] = []
  const counts = new Map<string, number>()
  for (const item of packages) {
    const scope = scopeOf(item.pkg)
    if (scope === '') continue
    if (!counts.has(scope)) order.push(scope)
    counts.set(scope, (counts.get(scope) ?? 0) + 1)
  }
  return order.map((scope) => ({ scope, count: counts.get(scope)! }))
}

/** 检索回执里的 `note`：有就是「哪几条源没查成」那句，没有（或不是字符串）返回空串 */
export function acceptNote(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

/** 检查形状。**认不出的丢掉、不报错**——检索回执改了形状时宁可少显示几行，也不要整栏空白 */
export function acceptPackages(raw: unknown): SearchRow[] {
  if (!Array.isArray(raw)) return []
  const out: SearchRow[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const pkg = item['pkg']
    if (typeof pkg !== 'string' || pkg === '') continue
    const row: SearchRow = { pkg }
    const version = item['version']
    const description = item['description']
    if (typeof version === 'string' && version !== '') row.version = version
    if (typeof description === 'string' && description !== '') row.description = description
    out.push(row)
  }
  return out
}

/** 包名 → 它在 home 里的版本范围。`undefined` 表示没装。由窗格已经取到的 `plugin-manager.list` 结果得出 */
export type InstalledIndex = ReadonlyMap<string, string | undefined>

/** 表还没取到时用的那份。**空表不等于「一个都没装」**，界面要靠别的状态区分这两种情况 */
export const NO_INDEX: InstalledIndex = new Map<string, string | undefined>()

/**
 * 窗格已经取到的包 → 已装列表。**只收 `installed === true` 的**——那张表还会列出
 * 「cordis.yml 里有条目、但包不在 home 里」的包，这种在这一栏里就是**没装**，点「装」
 * 正是应该做的事。
 */
export function installedIndex(rows: readonly { pkg: string; installed: boolean; spec?: string }[]): InstalledIndex {
  const map = new Map<string, string | undefined>()
  for (const row of rows) if (row.installed) map.set(row.pkg, row.spec)
  return map
}

/** 列表上的一行 */
export interface MarketRow extends SearchRow {
  /** 这个包在 home 里 */
  installed: boolean
  /** 装的是哪个版本范围。装了才可能有 */
  spec?: string
}

/**
 * 搜索框的本地筛选：包名与 registry 上的简介一起筛，匹配子串、不区分大小写。
 * 检索在窗格打开时一次取回全部结果（总共几十个包），筛选完全在本地。
 * **不做正则**：写错的表达式静默匹配不到。
 */
export function matchesQuery(row: SearchRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    row.pkg.toLowerCase().includes(needle) ||
    (row.description ?? '').toLowerCase().includes(needle)
  )
}

/**
 * 检索结果 + 已装列表 → 要显示的行。**顺序照检索结果**（已按源排好），装没装不参与排序。
 * 给了 `scope` 就先按源筛（和 `query` 的文本筛选同时生效）；空串表示不筛。
 */
export function toRows(packages: readonly SearchRow[], index: InstalledIndex, query: string, scope = ''): MarketRow[] {
  const out: MarketRow[] = []
  for (const item of packages) {
    if (scope !== '' && scopeOf(item.pkg) !== scope) continue
    if (!matchesQuery(item, query)) continue
    const spec = index.get(item.pkg)
    if (spec === undefined && !index.has(item.pkg)) {
      out.push({ ...item, installed: false })
    } else {
      out.push(spec === undefined ? { ...item, installed: true } : { ...item, installed: true, spec })
    }
  }
  return out
}

export interface Summary {
  /** 配好的源上一共几个 */
  total: number
  /** 其中已经装了几个。**数的是筛选之前的全部** */
  installed: number
  /** 这次筛选出几行 */
  shown: number
}

export function summarize(
  packages: readonly SearchRow[],
  index: InstalledIndex,
  rows: readonly MarketRow[],
): Summary {
  let installed = 0
  for (const item of packages) if (index.has(item.pkg)) installed += 1
  return { total: packages.length, installed, shown: rows.length }
}
