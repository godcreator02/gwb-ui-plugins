import type { PluginPackageView, RemountedEntry, Updated, UpdatedPackage } from '@godcreator/gwb-plugin-manager/receipts'
import type { PluginManagerReceipts } from './receipts'
import type { CallResult } from './rows'

/**
 * 「全部更新」与单个包的「更新」都用它：把 `plugin-manager.update` 的回执写成窗格上的几行话，定下接着要不要整页重新加载。
 * 回执里用不到 `restartRequired`：窗格不传 `specs`，要不要重启已写在 note 里
 */

/** 插件管理回执里 fiber 的状态名，到了它才算回到运行状态 */
const FIBER_ACTIVE = 'ACTIVE'

function hasDeferredEntry(packages: readonly { entries: readonly RemountedEntry[] }[]): boolean {
  return packages.some((item) => item.entries.some((entry) => entry.action === 'deferred'))
}

export interface UpdateView {
  /** false：命令失败，或有条目没回到运行状态 */
  ok: boolean
  /** 多行 */
  text: string
  /**
   * 窗格接着自动调 `shell.reload` 整页重新加载：有包升级或跟着重新加载了，开着的窗格还在用旧的浏览器端代码。
   * 有条目没回到运行状态时为 false：整页重新加载会把失败清单清掉，由人看完再点状态栏的「刷新」
   */
  pageReloadNeeded: boolean
  /** 插件管理自己的条目在回执之后才重新加载，整页重新加载要等它加载完 */
  selfDeferred: boolean
}

/** `hello（remounted，ACTIVE）` */
function describeEntry(entry: RemountedEntry): string {
  return `${entry.id}（${entry.action}，${entry.state}）`
}

function describeEntries(entries: readonly RemountedEntry[]): string {
  return entries.length > 0 ? `：${entries.map(describeEntry).join('、')}` : '（没有条目）'
}

/** `@x/pkg 0.1.0 → 0.2.0：条目…`；没有 from 时写「装上 0.2.0」 */
function describeUpdatedPackage(item: UpdatedPackage): string {
  const versions = item.from === undefined ? `装上 ${item.to}` : `${item.from} → ${item.to}`
  return `${item.pkg} ${versions}${describeEntries(item.entries)}`
}

/** 重新加载时出错的、重新加载了却没到 ACTIVE 的；本来就停用的（skipped）、插件管理自己推迟的（deferred）不算 */
function describeFailure(pkg: string, entry: RemountedEntry): string | undefined {
  if (entry.action === 'failed') return `${pkg} 的 ${entry.id}：重新加载时出错：${entry.state}`
  if (entry.action === 'remounted' && entry.state !== FIBER_ACTIVE) return `${pkg} 的 ${entry.id}：重新加载了，停在 ${entry.state}`
  return undefined
}

function failuresOf(receipt: Updated): string[] {
  const failures: string[] = []
  for (const item of [...receipt.updated, ...receipt.dependents]) {
    for (const entry of item.entries) {
      const failure = describeFailure(item.pkg, entry)
      if (failure !== undefined) failures.push(failure)
    }
  }
  return failures
}

function describePageReload(receipt: Updated, failures: readonly string[]): string {
  const self = !receipt.selfDeferred
    ? ''
    : hasDeferredEntry(receipt.updated)
      ? '插件管理自己也升级了：等它重新加载完，'
      : '插件管理自己跟着重新加载：等它重新加载完，'
  if (failures.length > 0) return `${self}看完上面的失败原因（日志里也有），点状态栏的「刷新」整页重新加载界面`
  return self === '' ? '接着整页重新加载界面' : `${self}再整页重新加载界面`
}

function linesForReceipt(receipt: Updated, failures: readonly string[]): string[] {
  const lines = [`升了 ${receipt.updated.length} 个包：`, ...receipt.updated.map(describeUpdatedPackage)]
  if (receipt.dependents.length > 0) {
    lines.push(`跟着重新加载 ${receipt.dependents.length} 个包（自己没升级，依赖的包换了版本）：`)
    for (const item of receipt.dependents) lines.push(`${item.pkg}${describeEntries(item.entries)}`)
  }
  if (receipt.note !== undefined) lines.push(receipt.note)
  if (failures.length > 0) lines.push(`${failures.length} 条条目没回到运行状态：`, ...failures)
  lines.push(describePageReload(receipt, failures))
  return lines
}

export function describeUpdateReceipt(result: PluginManagerReceipts['plugin-manager.update']): UpdateView {
  // 失败原因只在外层 error，pnpm 输出的最后几行已经拼在里面
  if (!result.ok) return { ok: false, text: result.error, pageReloadNeeded: false, selfDeferred: false }
  const receipt = result.data
  if (receipt.updated.length === 0 && receipt.dependents.length === 0) {
    return { ok: true, text: receipt.note ?? '全都最新', pageReloadNeeded: false, selfDeferred: false }
  }
  const failures = failuresOf(receipt)
  return {
    ok: failures.length === 0,
    text: linesForReceipt(receipt, failures).join('\n'),
    pageReloadNeeded: failures.length === 0,
    selfDeferred: receipt.selfDeferred,
  }
}

export const SELF_REMOUNT_POLL_MS = 500
export const SELF_REMOUNT_TIMEOUT_MS = 30_000

type ListCommand = 'plugin-manager.list'

export interface WaitForOwnRemountDeps {
  call: (command: ListCommand) => Promise<PluginManagerReceipts[ListCommand]>
  sleep: (ms: number) => Promise<void>
  listCommand: ListCommand
  ownPkg: string
}

/** 这个包在 home 里、至少一条条目、没停用的条目全都加载起来了 */
function ownEntriesActive(packages: readonly PluginPackageView[], ownPkg: string): boolean {
  const own = packages.find((view) => view.pkg === ownPkg)
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
    let listed: PluginManagerReceipts[ListCommand]
    try {
      listed = await deps.call(deps.listCommand)
    } catch (err: unknown) {
      // 重新加载的那段时间里调用失败是预期内的，下一轮再问
      lastReason = String(err)
      continue
    }
    if (!listed.ok) {
      lastReason = listed.error
      continue
    }
    if (ownEntriesActive(listed.data, deps.ownPkg)) return { ok: true, data: undefined }
    lastReason = '条目还没加载起来'
  }
  return {
    ok: false,
    error: `插件管理自己的条目 ${String(SELF_REMOUNT_TIMEOUT_MS / 1000)} 秒内没有重新加载起来（最后一次：${lastReason}）。原因看日志，加载起来之后点状态栏的「刷新」`,
  }
}
