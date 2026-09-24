import type { CallResult } from './rows'

/** 按插件管理 `UpdateAllResult` 的形状收窄，不 import 那边的类型；「全部更新」与单个包的「更新」都用它 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export interface UpdateAllView {
  ok: boolean
  /** 多行 */
  text: string
  /** 整页重载已经开始（done / deferred），窗格随时会被重新加载，忙碌状态不要撤 */
  reloading: boolean
}

/** `hello（remounted，ACTIVE）` */
function describeEntry(rawEntry: unknown): string {
  if (!isRecord(rawEntry)) return ''
  return `${stringOrEmpty(rawEntry['id'])}（${stringOrEmpty(rawEntry['action'])}，${stringOrEmpty(rawEntry['state'])}）`
}

/** `@x/pkg 0.1.0 → 0.2.0：条目…`；不是对象回 undefined */
function describeUpdatedPackage(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined
  const entries = Array.isArray(item['entries']) ? (item['entries'] as unknown[]).map(describeEntry).filter((line) => line !== '') : []
  return `${stringOrEmpty(item['pkg'])} ${stringOrEmpty(item['from'])} → ${stringOrEmpty(item['to'])}${entries.length > 0 ? `：${entries.join('、')}` : '（没有条目）'}`
}

function linesForUpdatedPackages(data: Record<string, unknown>, updated: unknown[]): string[] {
  const lines = [`升了 ${updated.length} 个包：`]
  for (const item of updated) {
    const line = describeUpdatedPackage(item)
    if (line !== undefined) lines.push(line)
  }
  if (data['selfDeferred'] === true) lines.push('插件管理自己也升级了：这个窗格随后先关再开')
  const reload = data['reload']
  if (reload === 'done') lines.push('界面已整页重载')
  else if (reload === 'deferred') lines.push('界面随后整页重载')
  const note = stringOrEmpty(data['note'])
  if (note !== '') lines.push(note)
  return lines
}

export function describeUpdateAll(result: CallResult): UpdateAllView {
  // 失败时插件管理已把 pnpm 输出的最后几行拼进 error，原样显示
  if (!result.ok) return { ok: false, text: result.error ?? '一键更新失败', reloading: false }
  const data = isRecord(result.data) ? result.data : {}
  const updated = Array.isArray(data['updated']) ? (data['updated'] as unknown[]) : []
  const lines = updated.length === 0 ? [stringOrEmpty(data['note']) || '全都最新'] : linesForUpdatedPackages(data, updated)
  const reload = data['reload']
  return { ok: true, text: lines.join('\n'), reloading: reload === 'done' || reload === 'deferred' }
}
