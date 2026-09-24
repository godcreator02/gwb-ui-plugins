import type { CallResult } from './rows'

/**
 * `plugin-manager.update-all` 的回执 → 显示在窗格上的那几行。纯逻辑，不碰 DOM；形状按插件管理的
 * `UpdateAllResult` 收，**不 import 那边的类型**（经 IPC 传过来的值当 `unknown` 收窄，
 * 和 rows.ts 一个规矩）。「全部更新」和单个包的「更新」（`only` 只列这一个包）共用它。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export interface UpdateAllView {
  ok: boolean
  /** 显示的话，多行 */
  text: string
  /** 整页重载已经开始（done / deferred）——窗格随时会被重新加载，忙碌状态不要撤 */
  reloading: boolean
}

/** 一条条目那一行：`hello（remounted，ACTIVE）` */
function describeEntry(raw: unknown): string {
  if (!isRecord(raw)) return ''
  return `${str(raw['id'])}（${str(raw['action'])}，${str(raw['state'])}）`
}

export function describeUpdateAll(result: CallResult): UpdateAllView {
  // 失败时插件管理已经把 pnpm 输出的最后几行拼进 error，这里原样显示，不再从 data.tail 拼一遍
  if (!result.ok) return { ok: false, text: result.error ?? '一键更新没成', reloading: false }
  const data = isRecord(result.data) ? result.data : {}
  const updated = Array.isArray(data['updated']) ? (data['updated'] as unknown[]) : []
  const lines: string[] = []
  if (updated.length === 0) {
    lines.push(str(data['note']) || '全都最新')
  } else {
    lines.push(`升了 ${updated.length} 个包：`)
    for (const item of updated) {
      if (!isRecord(item)) continue
      const entries = Array.isArray(item['entries']) ? (item['entries'] as unknown[]).map(describeEntry).filter((s) => s !== '') : []
      lines.push(`${str(item['pkg'])} ${str(item['from'])} → ${str(item['to'])}${entries.length > 0 ? `：${entries.join('、')}` : '（没有条目）'}`)
    }
    if (data['selfDeferred'] === true) lines.push('插件管理自己也升级了：这个窗格随后先关再开')
    const reload = data['reload']
    if (reload === 'done') lines.push('界面已整页重载')
    else if (reload === 'deferred') lines.push('界面随后整页重载')
    const note = str(data['note'])
    if (note !== '') lines.push(note)
  }
  const reload = data['reload']
  return { ok: true, text: lines.join('\n'), reloading: reload === 'done' || reload === 'deferred' }
}
