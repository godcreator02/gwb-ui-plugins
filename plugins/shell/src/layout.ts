/** gwbData 里布局文件的文档名 */
export const LAYOUT_DOC = 'layout'
/** 浏览器侧 import 的是本模块（纯逻辑、不带 cordis），所以这两个命令名放在这里 */
export const LAYOUT_GET_COMMAND = 'shell.layout.get'
export const LAYOUT_SAVE_COMMAND = 'shell.layout.save'

/** 改形状就加一；只认这一个版本，别的版本认不出 */
export const LAYOUT_VERSION = 3

/** 一套人手起名存下的布局 */
export interface SavedLayout {
  /** 文件内部的键（`l1`、`l2`…），人看的是 `name` */
  id: string
  name: string
  /** 容器的 `toJSON()` 结果，原样保存，应用时原样交给 `fromJSON` */
  layout: Record<string, unknown>
}

/** 一张桌面在布局文件里的那一条 */
export interface DesktopRow {
  /** 身份（`d1`、`d2`…），切换与可见性通知都按它 */
  id: string
  /** 给人看的名字，可以重名 */
  name: string
  /** 这张桌面容器的 `toJSON()` 结果；null 是没保存过，容器挂载时按默认布局打开 */
  layout: Record<string, unknown> | null
}

/** 布局文件本体 */
export interface LayoutDoc {
  v: number
  /** 重启回到哪张桌面（desktops 里某条的 id） */
  active: string
  desktops: DesktopRow[]
  saved: SavedLayout[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 坏一条整份当没有：文件是机器写的，坏一条通常整份都有问题 */
function parseSavedLayouts(raw: unknown): SavedLayout[] | null {
  if (!Array.isArray(raw)) return null
  const savedLayouts: SavedLayout[] = []
  const seenIds = new Set<string>()
  for (const item of raw) {
    if (!isPlainObject(item)) return null
    const { id, name, layout } = item
    if (typeof id !== 'string' || id === '') return null
    if (typeof name !== 'string' || name === '') return null
    if (!isPlainObject(layout)) return null
    if (seenIds.has(id)) return null
    seenIds.add(id)
    savedLayouts.push({ id, name, layout })
  }
  return savedLayouts
}

/** 对象（dockview 的 toJSON）或 null（没保存过）；别的回 undefined，表示文件坏了 */
function parseContainerLayout(raw: unknown): Record<string, unknown> | null | undefined {
  if (raw === null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return undefined
}

function parseDesktopRows(raw: unknown): DesktopRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const desktopRows: DesktopRow[] = []
  const seenIds = new Set<string>()
  for (const item of raw) {
    if (!isPlainObject(item)) return null
    const { id, name } = item
    if (typeof id !== 'string' || id === '') return null
    if (typeof name !== 'string' || name === '') return null
    const layout = parseContainerLayout(item.layout)
    if (layout === undefined) return null
    if (seenIds.has(id)) return null
    seenIds.add(id)
    desktopRows.push({ id, name, layout })
  }
  return desktopRows
}

/** 磁盘上读到的 → 布局文件。认不出（含 v3 以外的版本）回 null */
export function parseLayoutDoc(raw: unknown): LayoutDoc | null {
  if (!isPlainObject(raw)) return null
  if (raw.v !== LAYOUT_VERSION) return null
  const { active } = raw
  if (typeof active !== 'string' || active === '') return null
  const desktops = parseDesktopRows(raw.desktops)
  if (desktops === null) return null
  if (!desktops.some((desktop) => desktop.id === active)) return null
  const saved = parseSavedLayouts(raw.saved)
  if (saved === null) return null
  return { v: LAYOUT_VERSION, active, desktops, saved }
}

/** 第一次启动、读不回布局文件时用：一张「桌面 1」，layout 为 null */
export function defaultDoc(): LayoutDoc {
  return { v: LAYOUT_VERSION, active: 'd1', desktops: [{ id: 'd1', name: '桌面 1', layout: null }], saved: [] }
}

/** 启动时从哪份布局开始；`saveBlockedBy` 有值时 doc 是默认布局，这一轮不能保存，否则会覆盖磁盘上那份读不回来的 */
export interface InitialLayout {
  doc: LayoutDoc
  saveBlockedBy?: string
}

function versionLabelOf(data: unknown): string {
  if (!isPlainObject(data)) return `内容是 ${data === null ? 'null' : typeof data}`
  return data.v === undefined ? '没有 v' : `v=${JSON.stringify(data.v)}`
}

/**
 * `shell.layout.get` 的结果（`Promise.allSettled` 的一项）→ 启动时用的布局。只有回 ok、`data` 是 undefined
 * （gwbData 对不存在的文档回 undefined）才算第一次启动；调不通、回失败、认不出都停止保存
 */
export function initialLayoutOf(settled: PromiseSettledResult<unknown>): InitialLayout {
  if (settled.status === 'rejected') {
    return { doc: defaultDoc(), saveBlockedBy: `${LAYOUT_GET_COMMAND} 调不通：${String(settled.reason)}` }
  }
  const reply = settled.value
  if (!isPlainObject(reply) || reply.ok !== true) {
    const error = isPlainObject(reply) && typeof reply.error === 'string' ? reply.error : `回的是 ${reply === undefined ? 'undefined' : JSON.stringify(reply)}`
    return { doc: defaultDoc(), saveBlockedBy: `${LAYOUT_GET_COMMAND} 没回布局文件：${error}` }
  }
  if (reply.data === undefined) return { doc: defaultDoc() }
  const doc = parseLayoutDoc(reply.data)
  if (doc === null) {
    return { doc: defaultDoc(), saveBlockedBy: `磁盘上的布局文件认不出（${versionLabelOf(reply.data)}，外壳只认 v${String(LAYOUT_VERSION)}）` }
  }
  return { doc }
}

/** 容器挂载之后什么时候保存：不保存、排一次防抖保存、立刻保存 */
export type WellBootSave = 'none' | 'debounced' | 'now'

/**
 * 容器挂载时开不开默认布局、要不要保存。开默认布局发生在订阅 onDidLayoutChange 之前，dockview 丢弃订阅之前触发的
 * 布局变化，所以开了默认布局必须自己排一次保存；运行时新建的桌面保持为空、立刻保存，用空快照替换文件里的 null
 */
export function wellBootPlan(state: { restored: boolean; bornEmpty: boolean }): { openDefaults: boolean; save: WellBootSave } {
  if (state.bornEmpty) return { openDefaults: false, save: 'now' }
  if (state.restored) return { openDefaults: false, save: 'none' }
  return { openDefaults: true, save: 'debounced' }
}

/** 最小的没被占用的 `dN`；删过再建会复用号，无害 */
export function nextDesktopId(desktops: readonly DesktopRow[]): string {
  const takenIds = new Set(desktops.map((desktop) => desktop.id))
  for (let n = 1; ; n++) {
    const id = `d${n}`
    if (!takenIds.has(id)) return id
  }
}

/** 同名覆盖（名字就是键），覆盖时保留原条目的 id；返回新数组 */
export function upsertSaved(saved: readonly SavedLayout[], name: string, layout: Record<string, unknown>): SavedLayout[] {
  const sameName = saved.find((savedLayout) => savedLayout.name === name)
  const otherNames = saved.filter((savedLayout) => savedLayout.name !== name)
  return [...otherNames, { id: sameName?.id ?? nextLayoutId(otherNames), name, layout }]
}

/** 最小的没被占用的 `lN`；删过再存会复用号，无害 */
export function nextLayoutId(saved: readonly SavedLayout[]): string {
  const takenIds = new Set(saved.map((savedLayout) => savedLayout.id))
  for (let n = 1; ; n++) {
    const id = `l${n}`
    if (!takenIds.has(id)) return id
  }
}
