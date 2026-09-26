import type { EntrySnapshot, PluginPackageView, UnmetPeer } from '@godcreator/gwb-plugin-manager/receipts'

/**
 * `plugin-manager.list` 的回执 → 界面上的行。分包、条目两层：一个包能有多条条目，`pkg` 是装哪个包，`id` 才是身份
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `disabled` 是 yml 里写了停用（人的意愿），`active` 是 fiber 确实在运行（此刻的事实），四种组合都要说清：
 * 合成一个状态会把 `stalled` 说成「已停用」，而它恰恰最该被看见
 */
export type EntryState = 'active' | 'stalled' | 'disabled' | 'disabled-running'

interface StateFace {
  text: string
  hint: string
  /** 要显眼：不是人要它停的，是它自己没加载起来 */
  attention: boolean
}

const FACES: Record<EntryState, StateFace> = {
  active: { text: '已加载', hint: 'fiber 在运行', attention: false },
  stalled: {
    text: '没加载起来',
    hint: '没被停用，可它的 fiber 没运行起来——多半是 inject 要的服务还没到齐，或者它提供的服务已经被同名的占了。原因在日志里',
    attention: true,
  },
  disabled: { text: '已停用', hint: 'cordis.yml 里写着 disabled: true，本来就不该运行', attention: false },
  'disabled-running': {
    text: '已停用（还在运行）',
    hint: 'cordis.yml 里写了停用，可 fiber 还在运行。通常是刚停用那一瞬，再取一次表就一致了',
    attention: true,
  },
}

export function stateOf(entry: Pick<EntrySnapshot, 'disabled' | 'active'>): EntryState {
  if (entry.disabled) return entry.active ? 'disabled-running' : 'disabled'
  return entry.active ? 'active' : 'stalled'
}

export interface EntryRow {
  entryId: string
  /** 始终显示：它是身份，日志和 yml 里出现的是它，显示名只是给人看的 */
  id: string
  state: EntryState
  text: string
  hint: string
  attention: boolean
  /** 启用／停用开关看这个字段，不看 active */
  disabled: boolean
}

function toEntryRow(entry: EntrySnapshot): EntryRow {
  const state = stateOf(entry)
  const face = FACES[state]
  return {
    entryId: entry.entryId,
    id: entry.id,
    state,
    text: face.text,
    hint: face.hint,
    attention: face.attention,
    disabled: entry.disabled,
  }
}

export interface PackageRow {
  pkg: string
  spec?: string
  /** home 的 dependencies 里有它；false 是 yml 里有条目、包却不在 home 里 */
  installed: boolean
  entries: EntryRow[]
  /** 包这一层的一句话，没有就不显示 */
  note?: string
  noteHint?: string
  unmetPeers: UnmetPeer[]
}

/** 分组条目不是插件，先去掉；去掉后既没条目也没包名的不成一行 */
function packageRowOf(view: PluginPackageView): PackageRow | undefined {
  const entries = view.entries.filter((entry) => !entry.group).map(toEntryRow)
  if (view.pkg === '' && entries.length === 0) return undefined
  const row: PackageRow = {
    pkg: view.pkg,
    installed: view.installed,
    entries,
    unmetPeers: view.unmetPeers,
  }
  if (view.spec !== undefined) row.spec = view.spec
  if (entries.length === 0) {
    // 如实说「没有条目」，不说「未启用」：跟「有条目但停用了」是两回事
    row.note = '没有条目'
    row.noteHint =
      '这个包在 home 里，但 cordis.yml 里没有指向它的条目，所以没有加载。是插件就加一条条目；不是插件（没有 apply）的包不该装进 home，卸载它'
  }
  return row
}

/** 顺序照收，插件管理已经按包名排好 */
export function toRows(views: readonly PluginPackageView[]): PackageRow[] {
  const rows: PackageRow[] = []
  for (const view of views) {
    const row = packageRowOf(view)
    if (row !== undefined) rows.push(row)
  }
  return rows
}

/** 「peer 没满足」标记上的字 */
export interface UnmetPeerMark {
  text: string
  /** 悬停提示，一项一行 */
  hint: string
}

const KERNEL_PACKAGE = '@godcreator/gwb-kernel-desktop'

function describeUnmetPeer(peer: UnmetPeer): string {
  if (peer.installed === undefined) return `${peer.pkg} 要 ${peer.range}，没装`
  if (peer.pkg === KERNEL_PACKAGE) return `${peer.pkg} 要 ${peer.range}，运行中的内核是 ${peer.installed}`
  return `${peer.pkg} 要 ${peer.range}，装着 ${peer.installed}`
}

/** peer 全满足的包不标，回 undefined */
export function unmetPeerMark(row: Pick<PackageRow, 'unmetPeers'>): UnmetPeerMark | undefined {
  if (row.unmetPeers.length === 0) return undefined
  return {
    text: 'peer 没满足',
    hint: [
      '这个包 peerDependencies 里写的下面几项，home 里没装或版本不在范围里（主版本号为 0 时次版本号要相同，≥1 时主版本号要相同，都不能低于下限）。不等于加载不了，出了问题先怀疑它：',
      ...row.unmetPeers.map(describeUnmetPeer),
    ].join('\n'),
  }
}

export interface Summary {
  packages: number
  entries: number
}

export function summarize(rows: readonly PackageRow[]): Summary {
  let entries = 0
  for (const row of rows) entries += row.entries.length
  return { packages: rows.length, entries }
}

/**
 * 设置插件与外壳的命令回执（它们不导出回执类型，按形状收窄）；插件管理的回执用它 `./receipts` 子路径的类型，见 `receipts.ts`。
 * `error` 一个字都不许丢，失败时一定非空
 */
export type CallResult = { ok: true; data: unknown } | { ok: false; error: string }

export function asResult(value: unknown): CallResult {
  if (!isRecord(value)) return { ok: false, error: `命令返回了认不出的值：${String(value)}` }
  const error = value['error']
  if (value['ok'] === true) return { ok: true, data: value['data'] }
  // 失败却没给原因时也要有句话：空的错误提示跟没提示一样
  return { ok: false, error: typeof error === 'string' && error !== '' ? error : '命令失败，没有给出原因' }
}
