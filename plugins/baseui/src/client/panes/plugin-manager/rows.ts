/**
 * 按插件管理 `inventory.ts` 的形状收窄，不 import 那边的类型。
 * 分包、条目两层：一个包能有多条条目，`name` 是装哪个包，`id` 才是身份
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 与插件管理的 `PluginEntryView` 同形 */
export interface EntryView {
  /** 不带前缀的 id，cordis.yml 与日志里出现的是它 */
  id: string
  /** 完整 entryId，每条命令收的都是它 */
  entryId: string
  pkg: string
  /** yml 里写了 `disabled: true` */
  disabled: boolean
  /** fiber 确实在运行 */
  active: boolean
  /** `group: true` 的条目是分组，不是插件 */
  group: boolean
  label?: string
}

/** 与插件管理的 `PluginPackageView` 加上内核测试状态同形 */
export interface PackageView {
  pkg: string
  spec?: string
  installed: boolean
  entries: EntryView[]
  /** 包的 peerDependencies 里内核包 `@godcreator/gwb-kernel-desktop` 的范围；没声明时没有这个字段 */
  kernelRange?: string
  /** 范围不包含运行中的内核（含没声明、写的不是 ^x.y.z） */
  kernelUntested: boolean
}

/** 认不出的丢掉、不报错：插件管理改了形状而窗格没跟上时，宁可少显示几行也不要整个窗格空白 */
function acceptEntry(value: unknown): EntryView | undefined {
  if (!isRecord(value)) return undefined
  const id = value['id']
  if (typeof id !== 'string' || id === '') return undefined
  const entryId = value['entryId']
  const pkg = value['pkg']
  const label = value['label']
  const view: EntryView = {
    id,
    entryId: typeof entryId === 'string' && entryId !== '' ? entryId : id,
    pkg: typeof pkg === 'string' ? pkg : '',
    disabled: value['disabled'] === true,
    active: value['active'] === true,
    group: value['group'] === true,
  }
  return typeof label === 'string' && label !== '' ? { ...view, label } : view
}

function acceptEntryList(rawEntries: unknown): EntryView[] {
  if (!Array.isArray(rawEntries)) return []
  const entries: EntryView[] = []
  for (const rawEntry of rawEntries as unknown[]) {
    const entry = acceptEntry(rawEntry)
    if (entry !== undefined) entries.push(entry)
  }
  return entries
}

function acceptPackage(item: unknown): PackageView | undefined {
  if (!isRecord(item)) return undefined
  const pkg = item['pkg']
  if (typeof pkg !== 'string') return undefined
  const view: PackageView = { pkg, installed: item['installed'] === true, entries: acceptEntryList(item['entries']), kernelUntested: item['kernelUntested'] === true }
  const spec = item['spec']
  if (typeof spec === 'string') view.spec = spec
  const kernelRange = item['kernelRange']
  if (typeof kernelRange === 'string' && kernelRange !== '') view.kernelRange = kernelRange
  return view
}

/** 顺序照收，插件管理已经按包名排好 */
export function acceptPackages(raw: unknown): PackageView[] {
  if (!Array.isArray(raw)) return []
  const packages: PackageView[] = []
  for (const item of raw as unknown[]) {
    const view = acceptPackage(item)
    if (view !== undefined) packages.push(view)
  }
  return packages
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

export function stateOf(entry: Pick<EntryView, 'disabled' | 'active'>): EntryState {
  if (entry.disabled) return entry.active ? 'disabled-running' : 'disabled'
  return entry.active ? 'active' : 'stalled'
}

export interface EntryRow {
  entryId: string
  /** 始终显示：它是身份，日志和 yml 里出现的是它，label 只是给人看的名字 */
  id: string
  label?: string
  state: EntryState
  text: string
  hint: string
  attention: boolean
  /** 启用／停用开关看这个字段，不看 active */
  disabled: boolean
}

function toEntryRow(entry: EntryView): EntryRow {
  const state = stateOf(entry)
  const face = FACES[state]
  const row: EntryRow = {
    entryId: entry.entryId,
    id: entry.id,
    state,
    text: face.text,
    hint: face.hint,
    attention: face.attention,
    disabled: entry.disabled,
  }
  return entry.label === undefined ? row : { ...row, label: entry.label }
}

/** 卸载是包级动作（`plugin-manager.uninstall`），入口在窗格里，不在行上 */
export interface PackageRow {
  pkg: string
  /** 包名为空（条目没写 name）时显示一句说明 */
  title: string
  spec?: string
  /** home 的 dependencies 里有它；false 是 yml 里有条目、包却不在 home 里 */
  installed: boolean
  entries: EntryRow[]
  /** 包这一层的一句话，没有就不显示 */
  note?: string
  noteHint?: string
  kernelRange?: string
  kernelUntested: boolean
}

/** 分组条目不是插件，先去掉；去掉后既没条目也没包名的不成一行 */
function packageRowOf(view: PackageView): PackageRow | undefined {
  const entries = view.entries.filter((entry) => !entry.group).map(toEntryRow)
  if (view.pkg === '' && entries.length === 0) return undefined
  const row: PackageRow = {
    pkg: view.pkg,
    title: view.pkg === '' ? '（条目没写 name）' : view.pkg,
    installed: view.installed,
    entries,
    kernelUntested: view.kernelUntested,
  }
  if (view.spec !== undefined) row.spec = view.spec
  if (view.kernelRange !== undefined) row.kernelRange = view.kernelRange
  if (entries.length === 0) {
    // 如实说「没有条目」，不说「未启用」：跟「有条目但停用了」是两回事
    row.note = '没有条目'
    row.noteHint =
      '这个包在 home 里，但 cordis.yml 里没有指向它的条目，所以没有加载。是插件就加一条条目；不是插件（没有 apply）的包不该装进 home，卸载它'
  }
  return row
}

export function toRows(views: readonly PackageView[]): PackageRow[] {
  const rows: PackageRow[] = []
  for (const view of views) {
    const row = packageRowOf(view)
    if (row !== undefined) rows.push(row)
  }
  return rows
}

/** 「没在当前内核上测过」标记上的字 */
export interface KernelTestMark {
  text: string
  hint: string
}

/** 声明的范围包含当前内核的包不标，回 undefined */
export function kernelTestMark(row: Pick<PackageRow, 'kernelUntested' | 'kernelRange'>): KernelTestMark | undefined {
  if (!row.kernelUntested) return undefined
  return {
    text: `内核未测过 · ${row.kernelRange ?? '未声明'}`,
    hint:
      row.kernelRange === undefined
        ? '这个包的 package.json 没有在 peerDependencies 里写内核包 @godcreator/gwb-kernel-desktop 的版本范围，不知道它在当前内核上能不能用。不等于加载不了，出了问题先怀疑它'
        : `这个包声明兼容的内核是 ${row.kernelRange}，不包含运行中的内核（主版本号为 0 时次版本号要相同，≥1 时主版本号要相同，都不能低于下限）。不等于加载不了，出了问题先怀疑它`,
  }
}

export interface Summary {
  packages: number
  entries: number
  /** 没停用也没加载起来的条目数 */
  attention: number
}

export function summarize(rows: readonly PackageRow[]): Summary {
  let entries = 0
  let attention = 0
  for (const row of rows) {
    entries += row.entries.length
    for (const entry of row.entries) if (entry.attention) attention += 1
  }
  return { packages: rows.length, entries, attention }
}

/** 命令的回执；`error` 一个字都不许丢 */
export interface CallResult {
  ok: boolean
  data?: unknown
  error?: string
}

export function asResult(value: unknown): CallResult {
  if (!isRecord(value)) return { ok: false, error: `命令返回了认不出的值：${String(value)}` }
  const error = value['error']
  if (value['ok'] === true) return value['data'] === undefined ? { ok: true } : { ok: true, data: value['data'] }
  // 失败却没给原因时也要有句话：空的错误提示跟没提示一样
  return { ok: false, error: typeof error === 'string' && error !== '' ? error : '命令失败，没有给出原因' }
}
