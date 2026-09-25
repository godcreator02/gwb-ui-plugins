import { acceptPackages, asResult, type CallResult } from './rows'

/** 按插件管理 `plugin-manager.update` 回执的形状收窄，不 import 那边的类型；「全部更新」与单个包的「更新」都用它 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export interface UpdateView {
  ok: boolean
  /** 多行 */
  text: string
  /** 有包升级了：开着的窗格还在用旧的浏览器端代码，要调 `shell.reload` 整页重新加载 */
  pageReloadNeeded: boolean
  /** 插件管理自己的条目在回执之后才重新加载，整页重新加载要等它加载完 */
  selfDeferred: boolean
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
  const note = stringOrEmpty(data['note'])
  if (note !== '') lines.push(note)
  lines.push(data['selfDeferred'] === true ? '插件管理自己也升级了：等它重新加载完，再整页重新加载界面' : '接着整页重新加载界面')
  return lines
}

export function describeUpdateReceipt(result: CallResult): UpdateView {
  // 失败原因只在外层 error，pnpm 输出的最后几行已经拼在里面
  if (!result.ok) return { ok: false, text: result.error ?? '更新失败', pageReloadNeeded: false, selfDeferred: false }
  const data = isRecord(result.data) ? result.data : {}
  const updated = Array.isArray(data['updated']) ? (data['updated'] as unknown[]) : []
  if (updated.length === 0) return { ok: true, text: stringOrEmpty(data['note']) || '全都最新', pageReloadNeeded: false, selfDeferred: false }
  return { ok: true, text: linesForUpdatedPackages(data, updated).join('\n'), pageReloadNeeded: true, selfDeferred: data['selfDeferred'] === true }
}

export const SELF_REMOUNT_POLL_MS = 500
export const SELF_REMOUNT_TIMEOUT_MS = 30_000

export interface WaitForOwnRemountDeps {
  call: (command: string) => Promise<unknown>
  sleep: (ms: number) => Promise<void>
  listCommand: string
  ownPkg: string
}

/** 这个包在 home 里、至少一条条目、没停用的条目全都加载起来了 */
function ownEntriesActive(listData: unknown, ownPkg: string): boolean {
  const own = acceptPackages(listData).find((view) => view.pkg === ownPkg)
  if (own === undefined || own.entries.length === 0) return false
  return own.entries.every((entry) => entry.disabled || entry.active)
}

/**
 * 页面启动时只取一次窗格注册表：插件管理自己重新加载的那段时间里它的服务不在，插件管理窗格也就不在注册表里，
 * 这时整页重新加载，重新加载后的页面上就没有这个窗格。所以等它加载完再重新加载。
 * 每轮先等再问：回执发出后插件管理才开始重新加载，马上问会问到还没卸载的旧的那份
 */
export async function waitForOwnRemount(deps: WaitForOwnRemountDeps): Promise<CallResult> {
  let lastReason = '条目还没加载起来'
  for (let waited = 0; waited < SELF_REMOUNT_TIMEOUT_MS; waited += SELF_REMOUNT_POLL_MS) {
    await deps.sleep(SELF_REMOUNT_POLL_MS)
    let listed: CallResult
    try {
      listed = asResult(await deps.call(deps.listCommand))
    } catch (err: unknown) {
      // 重新加载的那段时间里调用失败是预期内的，下一轮再问
      lastReason = String(err)
      continue
    }
    if (!listed.ok) {
      lastReason = listed.error ?? ''
      continue
    }
    if (ownEntriesActive(listed.data, deps.ownPkg)) return { ok: true }
    lastReason = '条目还没加载起来'
  }
  return {
    ok: false,
    error: `插件管理自己的条目 ${String(SELF_REMOUNT_TIMEOUT_MS / 1000)} 秒内没有重新加载起来（最后一次：${lastReason}）。原因看日志，加载起来之后点状态栏的「刷新」`,
  }
}
