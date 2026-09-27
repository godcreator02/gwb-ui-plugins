/** 条目是 `logger.query` 从日志文件原样读出的对象，经 IPC 传来，按形状收窄、不引日志插件的类型包 */

/** 插件、内核（含 loader）、渲染层 console 三个来源 */
export const SOURCES = ['plugin', 'kernel', 'renderer'] as const
export type LogSource = (typeof SOURCES)[number]

/** 从严重到不严重，级别门限按这个顺序 */
export const LEVELS = ['error', 'warn', 'info', 'debug'] as const
export type LogLevel = (typeof LEVELS)[number]

export interface LogEntry {
  /** ISO 8601 的 UTC 时间字符串 */
  ts: string
  level: LogLevel
  source: LogSource
  name: string
  msg: string
}

/** 列表里的一行：条目没有唯一编号，`rowKey` 是本窗格按到达顺序给的计数，只当 React 的 key 用 */
export interface LogRow extends LogEntry {
  rowKey: number
}

const SOURCE_SET: ReadonlySet<string> = new Set(SOURCES)
const LEVEL_SET: ReadonlySet<string> = new Set(LEVELS)

function kindOf(value: unknown): string {
  if (value === null) return 'null'
  return Array.isArray(value) ? 'array' : typeof value
}

/** 字符串给出原文，其余给出类型 */
function describeValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : kindOf(value)
}

function acceptEntry(value: unknown, position: number): LogEntry {
  const where = `日志回执第 ${String(position)} 条`
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${where}要是对象，收到的是 ${kindOf(value)}`)
  }
  const { ts, level, source, name, msg } = value as Record<string, unknown>
  if (typeof ts !== 'string' || Number.isNaN(Date.parse(ts))) {
    throw new Error(`${where}的 ts 要是时间字符串，收到的是 ${describeValue(ts)}`)
  }
  if (typeof level !== 'string' || !LEVEL_SET.has(level)) {
    throw new Error(`${where}的 level 要是 ${LEVELS.join(' / ')} 之一，收到的是 ${describeValue(level)}`)
  }
  if (typeof source !== 'string' || !SOURCE_SET.has(source)) {
    throw new Error(`${where}的 source 要是 ${SOURCES.join(' / ')} 之一，收到的是 ${describeValue(source)}`)
  }
  if (typeof name !== 'string') throw new Error(`${where}的 name 要是字符串，收到的是 ${kindOf(name)}`)
  if (typeof msg !== 'string') throw new Error(`${where}的 msg 要是字符串，收到的是 ${kindOf(msg)}`)
  return { ts, level: level as LogLevel, source: source as LogSource, name, msg }
}

/**
 * 整份不是数组、或有一条形状不对就抛错：当成空数组，界面会把「取失败」说成「还没有日志」；
 * 悄悄丢掉认不出的条目，日志插件改了形状也没人发现
 */
export function acceptEntries(value: unknown): LogEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(`日志回执的 entries 要是数组，收到的是 ${kindOf(value)}`)
  }
  return value.map((item, index) => acceptEntry(item, index + 1))
}

/**
 * 不去重：每次拉取只取上一次 cursor 之后新写的，两批之间不交叠；同一毫秒两句一样的话是常事。
 * 超过 `cap` 从头丢掉；上限由渲染成本定（没有虚拟滚动），更早的去日志文件看
 */
export function appendRows(prev: readonly LogRow[], incoming: readonly LogEntry[], cap: number): LogRow[] {
  if (incoming.length === 0) return prev as LogRow[]
  const firstKey = prev.length === 0 ? 0 : prev[prev.length - 1]!.rowKey + 1
  const appended = incoming.map((entry, index) => ({ ...entry, rowKey: firstKey + index }))
  const merged = [...prev, ...appended]
  return merged.length > cap ? merged.slice(merged.length - cap) : merged
}

function zeroPadded(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** 本地时区的 `HH:mm:ss.SSS`：几路日志合在一起时要分先后，秒级分不开 */
export function clockOf(ts: string): string {
  const date = new Date(ts)
  return `${zeroPadded(date.getHours())}:${zeroPadded(date.getMinutes())}:${zeroPadded(date.getSeconds())}.${zeroPadded(date.getMilliseconds(), 3)}`
}
