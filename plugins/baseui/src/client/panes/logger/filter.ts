import { SOURCES, type LogEntry, type LogLevel, type LogSource } from './entries'

/** 越小越严重 */
const SEVERITY: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }

/** 四个条件是「与」的关系，所以界面上的空态要分清「一条都没有」和「被筛掉了」 */
export interface FilterState {
  /** 门限：显示这一级及以上，不是等值筛选 */
  level: LogLevel
  /** 空集合就是一条都不显示 */
  sources: ReadonlySet<LogSource>
  /** 空串是全部；值是 `source|name` 复合键，不同来源的同名不会混在一起 */
  key: string
  /** 子串、不区分大小写，同时匹配 name 与 msg；不用正则，写错的表达式会静默匹配不到 */
  search: string
}

export const ALL_SOURCES: ReadonlySet<LogSource> = new Set(SOURCES)

/** 什么都不筛：最低一级门限、三个来源全开 */
export const SHOW_EVERYTHING: FilterState = {
  level: 'debug',
  sources: ALL_SOURCES,
  key: '',
  search: '',
}

export function keyOf(entry: Pick<LogEntry, 'source' | 'name'>): string {
  return `${entry.source}|${entry.name}`
}

function matchesSearch(entry: LogEntry, search: string): boolean {
  if (search === '') return true
  const needle = search.toLowerCase()
  return entry.msg.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle)
}

export function matches(entry: LogEntry, filter: FilterState): boolean {
  if (SEVERITY[entry.level] > SEVERITY[filter.level]) return false
  if (!filter.sources.has(entry.source)) return false
  if (filter.key !== '' && keyOf(entry) !== filter.key) return false
  return matchesSearch(entry, filter.search)
}

/** 数的是筛选之前的全量，来源开关上显示 */
export function countBySource(entries: readonly LogEntry[]): Record<LogSource, number> {
  const countsBySource: Record<LogSource, number> = { plugin: 0, kernel: 0, renderer: 0 }
  for (const entry of entries) countsBySource[entry.source] += 1
  return countsBySource
}

/** 出现过的来源名，按来源分组、组内按名字排 */
export function groupNames(entries: readonly LogEntry[]): { source: LogSource; names: string[] }[] {
  const namesBySource = new Map<LogSource, Set<string>>()
  for (const entry of entries) {
    let names = namesBySource.get(entry.source)
    if (names === undefined) {
      names = new Set()
      namesBySource.set(entry.source, names)
    }
    names.add(entry.name)
  }
  return SOURCES
    .filter((source) => namesBySource.has(source))
    .map((source) => ({ source, names: [...namesBySource.get(source)!].sort() }))
}
