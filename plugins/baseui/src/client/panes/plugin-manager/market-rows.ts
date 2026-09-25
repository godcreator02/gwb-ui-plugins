/**
 * 「可装」一栏拿到检索结果之后的事：与已装列表对照、本地筛选、汇总。检索本身由插件管理（`plugin-manager.search`）做；
 * 结果按形状收窄，不 import 插件管理的 `SearchRow`
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 与插件管理的 `SearchRow` 同形 */
export interface SearchRow {
  pkg: string
  /** registry 上的最新版 */
  version?: string
  /** registry 上的一句话 */
  description?: string
}

/** `@j/gwb-x` → `@j`；没有 scope 回空串。每行的来源标签由它得出 */
export function scopeOf(pkg: string): string {
  if (!pkg.startsWith('@')) return ''
  const slashIndex = pkg.indexOf('/')
  return slashIndex === -1 ? '' : pkg.slice(0, slashIndex)
}

/** 按源筛选的一项：scope 和这个源在列表里的插件数 */
export interface ScopeOption {
  scope: string
  count: number
}

/**
 * 从当前已加载的行算出选项，列表里有什么源就列什么源；顺序按第一次出现的先后（检索回执已排好）。
 * 不去读 npmrc 里配了哪些源：跟着眼前的列表走比跟着配置走准确
 */
export function scopeOptions(packages: readonly SearchRow[]): ScopeOption[] {
  const scopesInFirstSeenOrder: string[] = []
  const countsByScope = new Map<string, number>()
  for (const item of packages) {
    const scope = scopeOf(item.pkg)
    if (scope === '') continue
    if (!countsByScope.has(scope)) scopesInFirstSeenOrder.push(scope)
    countsByScope.set(scope, (countsByScope.get(scope) ?? 0) + 1)
  }
  return scopesInFirstSeenOrder.map((scope) => ({ scope, count: countsByScope.get(scope)! }))
}

/** 检索回执里「哪几条源没查成」那句；没有或不是字符串回空串 */
export function acceptNote(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

function acceptSearchRow(item: unknown): SearchRow | undefined {
  if (!isRecord(item)) return undefined
  const pkg = item['pkg']
  if (typeof pkg !== 'string' || pkg === '') return undefined
  const row: SearchRow = { pkg }
  const version = item['version']
  const description = item['description']
  if (typeof version === 'string' && version !== '') row.version = version
  if (typeof description === 'string' && description !== '') row.description = description
  return row
}

/** 认不出的丢掉、不报错：回执改了形状时宁可少显示几行，也不要整栏空白 */
export function acceptPackages(raw: unknown): SearchRow[] {
  if (!Array.isArray(raw)) return []
  const rows: SearchRow[] = []
  for (const item of raw) {
    const row = acceptSearchRow(item)
    if (row !== undefined) rows.push(row)
  }
  return rows
}

/** 包名 → 它在 home 里的版本范围，`undefined` 表示没装 */
export type InstalledIndex = ReadonlyMap<string, string | undefined>

/** 表还没取到时用；空表不等于一个都没装，界面要靠别的状态区分 */
export const NO_INDEX: InstalledIndex = new Map<string, string | undefined>()

/** 只收 `installed === true` 的：yml 里有条目、包却不在 home 里的，在这一栏就是没装 */
export function installedIndex(rows: readonly { pkg: string; installed: boolean; spec?: string }[]): InstalledIndex {
  const specsByInstalledPkg = new Map<string, string | undefined>()
  for (const row of rows) if (row.installed) specsByInstalledPkg.set(row.pkg, row.spec)
  return specsByInstalledPkg
}

export interface MarketRow extends SearchRow {
  installed: boolean
  /** 装了才可能有 */
  spec?: string
}

/** 包名与简介一起筛，子串、不区分大小写；不用正则，写错的表达式会静默匹配不到 */
export function matchesQuery(row: SearchRow, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    row.pkg.toLowerCase().includes(needle) ||
    (row.description ?? '').toLowerCase().includes(needle)
  )
}

function marketRowOf(item: SearchRow, index: InstalledIndex): MarketRow {
  const spec = index.get(item.pkg)
  if (spec === undefined && !index.has(item.pkg)) return { ...item, installed: false }
  return spec === undefined ? { ...item, installed: true } : { ...item, installed: true, spec }
}

/** 顺序照检索结果；`scope` 与 `query` 同时生效，空串表示不按源筛 */
export function toRows(packages: readonly SearchRow[], index: InstalledIndex, query: string, scope = ''): MarketRow[] {
  const rows: MarketRow[] = []
  for (const item of packages) {
    if (scope !== '' && scopeOf(item.pkg) !== scope) continue
    if (!matchesQuery(item, query)) continue
    rows.push(marketRowOf(item, index))
  }
  return rows
}

export interface Summary {
  /** 配好的源上一共几个 */
  total: number
  /** 已经装了几个，数的是筛选之前的全部 */
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
