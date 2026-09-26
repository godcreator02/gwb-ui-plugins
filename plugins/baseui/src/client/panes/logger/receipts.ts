/** 命令回执按形状收窄。插件管理窗格的 `rows.ts` 有同样的一份：窗格之间不互相 import */

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

export interface LogWhere {
  home: string
  logFile: string
}

/** `logger.where` 的 data：两项都是字符串，缺一项就抛错 */
export function acceptWhere(data: unknown): LogWhere {
  if (!isRecord(data)) throw new Error(`logger.where 的回执要是对象，收到的是 ${kindOf(data)}`)
  const { home, logFile } = data
  if (typeof home !== 'string') throw new Error(`logger.where 回执里的 home 要是字符串，收到的是 ${kindOf(home)}`)
  if (typeof logFile !== 'string') throw new Error(`logger.where 回执里的 logFile 要是字符串，收到的是 ${kindOf(logFile)}`)
  return { home, logFile }
}
