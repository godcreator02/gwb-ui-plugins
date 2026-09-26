/** 条目经 IPC 传来，按形状收窄、不引内核的类型包：浏览器侧不依赖 node 侧的包 */

/** 插件、内核（含 loader）、渲染层 console 三个来源 */
export const SOURCES = ['plugin', 'kernel', 'renderer'] as const
export type LogSource = (typeof SOURCES)[number]

/** 从严重到不严重，级别门限按这个顺序 */
export const LEVELS = ['error', 'warn', 'info', 'debug'] as const
export type LogLevel = (typeof LEVELS)[number]

export interface LogEntry {
  /** 主进程发的序号，唯一键，去重与排序都用它 */
  seq: number
  ts: number
  source: LogSource
  level: LogLevel
  name: string
  msg: string
}

const SOURCE_SET: ReadonlySet<string> = new Set(SOURCES)
const LEVEL_SET: ReadonlySet<string> = new Set(LEVELS)

/** 认不出的丢掉、不报错：内核改了形状而本插件没跟上时，宁可少几行日志也不要整个窗格空白 */
export function isLogEntry(value: unknown): value is LogEntry {
  if (value === null || typeof value !== 'object') return false
  const { seq, ts, source, level, name, msg } = value as Record<string, unknown>
  return (
    typeof seq === 'number' &&
    Number.isFinite(seq) &&
    typeof ts === 'number' &&
    typeof source === 'string' &&
    SOURCE_SET.has(source) &&
    typeof level === 'string' &&
    LEVEL_SET.has(level) &&
    typeof name === 'string' &&
    typeof msg === 'string'
  )
}

/** 整份不是数组就抛错：当成空数组的话界面会说「还没有日志」，把「取失败」说成了「没有数据」 */
export function acceptEntries(batch: unknown): LogEntry[] {
  if (!Array.isArray(batch)) {
    throw new Error(`日志回执要是数组，收到的是 ${batch === null ? 'null' : typeof batch}`)
  }
  return batch.filter(isLogEntry)
}

/**
 * 按 `seq` 去重，不按内容：历史段与实时段必然交叠一小截，而同一毫秒两句一样的话是常事。
 * 超过 `cap` 从头截掉；上限由渲染成本定（没有虚拟滚动），更早的去日志文件看
 */
export function mergeEntries(prev: readonly LogEntry[], incoming: readonly LogEntry[], cap: number): LogEntry[] {
  if (incoming.length === 0) return prev as LogEntry[]
  const seenSeqs = new Set(prev.map((entry) => entry.seq))
  const newEntries = incoming.filter((entry) => !seenSeqs.has(entry.seq))
  if (newEntries.length === 0) return prev as LogEntry[]
  const merged = [...prev, ...newEntries].sort((a, b) => a.seq - b.seq)
  return merged.length > cap ? merged.slice(merged.length - cap) : merged
}

function zeroPadded(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** `HH:mm:ss.SSS`：几路日志合在一起时要分先后，秒级分不开 */
export function clockOf(ts: number): string {
  const date = new Date(ts)
  return `${zeroPadded(date.getHours())}:${zeroPadded(date.getMinutes())}:${zeroPadded(date.getSeconds())}.${zeroPadded(date.getMilliseconds(), 3)}`
}
