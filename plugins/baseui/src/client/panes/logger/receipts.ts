/** 命令回执按形状收窄。插件管理窗格的 `rows.ts` 有同样的一份：窗格之间不互相 import */

import { acceptEntries, type LogEntry } from './entries'

export type CallResult = { ok: true; data: unknown } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function kindOf(value: unknown): string {
  if (value === null) return 'null'
  return Array.isArray(value) ? 'array' : typeof value
}

/** 失败却没给原因时也要有句话：空的错误提示跟没提示一样 */
export function asResult(value: unknown): CallResult {
  if (!isRecord(value)) return { ok: false, error: `命令返回了认不出的值：${kindOf(value)}` }
  if (value['ok'] === true) return { ok: true, data: value['data'] }
  const error = value['error']
  return { ok: false, error: typeof error === 'string' && error !== '' ? error : '命令失败，没有给出原因' }
}

/** `logger.query` 的一次回执 */
export interface LogPage {
  /** `gwb.log` 的绝对路径 */
  file: string
  /** 读完时 `gwb.log` 的字节长度，下一次作为 `after` 传回去 */
  cursor: number
  /** 从旧到新 */
  entries: LogEntry[]
}

/** `logger.query` 的 data：三项缺一项、类型不对、entries 里有一条不对都抛错 */
export function acceptQueryPage(data: unknown): LogPage {
  if (!isRecord(data)) throw new Error(`logger.query 的回执要是对象，收到的是 ${kindOf(data)}`)
  const { file, cursor, entries } = data
  if (typeof file !== 'string') throw new Error(`logger.query 回执里的 file 要是字符串，收到的是 ${kindOf(file)}`)
  if (typeof cursor !== 'number' || !Number.isSafeInteger(cursor) || cursor < 0) {
    throw new Error(`logger.query 回执里的 cursor 要是非负整数，收到的是 ${typeof cursor === 'number' ? String(cursor) : kindOf(cursor)}`)
  }
  return { file, cursor, entries: acceptEntries(entries) }
}

/** 整份命令回执到一页日志；命令失败就把原因作为错误抛出 */
export function readQueryReply(reply: unknown): LogPage {
  const result = asResult(reply)
  if (!result.ok) throw new Error(result.error)
  return acceptQueryPage(result.data)
}
