/**
 * 面板 `params` 的读法：这一格是什么种类、背后挂的是哪个插件、哪条条目，以及这份
 * `params` 里哪一半是件自己传的。零 import、不碰 DOM，测试在 node 里直接跑。
 *
 * 一格是什么种类看 `view.contentComponent`（不拿 id 当判据——id 是调用方起的名字）；
 * 背后是哪个插件看 `params.pluginKey`（完整包名，跟条目视图的 `pkg` 同一个字符串）。
 */

/** 插件窗格的 component 名（COMPONENTS 表里的那个键） */
export const PLUGIN_COMPONENT = 'plugin'

/** dockview 面板上本文件要看的那一点形状 */
export interface PanelLike {
  view?: { contentComponent?: unknown }
  params?: Record<string, unknown> | undefined
}

/** 这一格是不是插件窗格 */
export function isPluginPanel(panel: PanelLike | null | undefined): boolean {
  return panel?.view?.contentComponent === PLUGIN_COMPONENT
}

/**
 * 这一格挂的是哪个插件（完整包名）。不是插件格、或者 params 里没有这一项，一律回空串
 * ——调用方拿到空串就跳过，不必自己再判一次种类。
 */
export function pluginKeyOf(panel: PanelLike | null | undefined): string {
  if (!isPluginPanel(panel)) return ''
  const key = panel?.params?.pluginKey
  return typeof key === 'string' ? key : ''
}

/**
 * 这一格属于哪条条目（cordis.yml 里那条的 id）。认不出就回空串——非插件格，或者
 * params 里没有这一项；params 缺这一项属于外壳的 bug，不判的话它会变成静默的错格匹配。
 */
export function entryIdOf(panel: PanelLike | null | undefined): string {
  if (!isPluginPanel(panel)) return ''
  const id = panel?.params?.entryId
  return typeof id === 'string' ? id : ''
}

/** 这一格是那个件的哪一格（`registerPane` 给的那个 id）。认不出同样回空串 */
export function paneIdOf(panel: PanelLike | null | undefined): string {
  if (!isPluginPanel(panel)) return ''
  const id = panel?.params?.paneId
  return typeof id === 'string' ? id : ''
}

/**
 * 这一格**装的是什么**：件开格时给的那个不透明字符串。
 *
 * **认不出回空串，而空串是个正当的值**——件不给 `key` 就等于给了空串，所以「没给 key」
 * 不是特例，它跟别的 key 走同一条查找路径。
 */
export function paneKeyOf(panel: PanelLike | null | undefined): string {
  if (!isPluginPanel(panel)) return ''
  const key = panel?.params?.key
  return typeof key === 'string' ? key : ''
}

/**
 * 这一格是不是**预览格**（下一次 preview 打开会顶掉它的那一份）。
 *
 * 判的是 `=== true`：正式格身上**没有这个键**（转正就是把它删掉），不是写成 false。
 */
export function isPreviewPanel(panel: PanelLike | null | undefined): boolean {
  if (!isPluginPanel(panel)) return false
  return panel?.params?.preview === true
}

/**
 * 外壳自己占着的那几个 `params` 键：识别三件套、标签图标，加内容身份两样（`key` /
 * `preview`）。件传的参数跟它们并排住在同一份 `params` 里，这张名单就是两边的分界：
 * 进面板前（`pluginParamsIn`）与出到件手上时各摘一遍。代价是件不能拿这几个名字当
 * 自己的参数名；换来的是它们跟着 panel params 落盘，外壳不用另存一份账。
 */
export const SHELL_PARAM_KEYS = ['pluginKey', 'entryId', 'paneId', 'icon', 'key', 'preview'] as const

const SHELL_PARAM_KEY_SET = new Set<string>(SHELL_PARAM_KEYS)

/**
 * 这份参数里踩了保留键的那几个名字，按给的顺序回。
 *
 * **摘掉要出声**：件传了 `entryId` 而它被无声无息地丢掉，现象是「我传的参数没到」，
 * 从那头查不到这儿。
 */
export function shellParamKeysIn(params: Record<string, unknown> | undefined): string[] {
  if (params === undefined) return []
  return Object.keys(params).filter((key) => SHELL_PARAM_KEY_SET.has(key))
}

/**
 * 一份 `params` 里**件自己那半**：把保留键摘干净。
 *
 * **一个键都不剩就回 undefined**，不回空对象——件手上 `pane.params === undefined` 因此
 * 干脆地等于「开这一份时没给参数」，用不着再数一遍键。
 */
export function pluginParamsIn(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (params === undefined) return undefined
  const mine = Object.entries(params).filter(([key]) => !SHELL_PARAM_KEY_SET.has(key))
  return mine.length === 0 ? undefined : Object.fromEntries(mine)
}

/**
 * 拿 `next` **整份换掉** `prev` 时要交给 `api.updateParameters` 的那份。dockview 的
 * updateParameters 是合并不是换（只有 undefined 的键删），旧那份多出来的键得显式写
 * `undefined`，不然会赖在这一格里跟着落盘。
 */
export function replaceParams(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  if (prev === undefined) return next
  const dropped = Object.keys(prev).filter((key) => !Object.hasOwn(next, key))
  return { ...Object.fromEntries(dropped.map((key) => [key, undefined])), ...next }
}

/**
 * 参数的门：平对象、JSON 序列化不炸。参数跟着面板进 `toJSON()` 整档落盘，循环引用在这儿就拦下，
 * 别让它写坏盘上那份布局档。开格（跨件命令）与上报内容同吃这一道。
 */
export function isPlainParams(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  try {
    JSON.stringify(value)
  } catch {
    return false
  }
  return true
}

/** 件经 `setPaneContent` 报上来的那一份：这个窗格此刻装的是什么 */
export interface PaneContent {
  /** 此刻装的内容的 key（同 `openPane` 的 key，不透明） */
  key: string
  /** 给了就**整份替换**件那半参数；不给件那半不动 */
  params?: Record<string, unknown>
  /** 给了等于顺带 `setPaneTitle` */
  title?: string
}

/** 件报上来的东西 → 一份合法的内容。件是 JS 写的，形状不能默认对 */
export function parsePaneContent(raw: unknown): { ok: true; content: PaneContent } | { ok: false; error: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'setPaneContent 要一个 { key, params?, title? } 对象' }
  }
  const c = raw as { key?: unknown; params?: unknown; title?: unknown }
  if (typeof c.key !== 'string') return { ok: false, error: 'setPaneContent 的 key 得是字符串（此刻装的内容）' }
  if (c.params !== undefined && !isPlainParams(c.params)) {
    return { ok: false, error: 'setPaneContent 的 params 得是平对象且可 JSON 序列化（它跟着布局落盘）' }
  }
  if (c.title !== undefined && typeof c.title !== 'string') return { ok: false, error: 'setPaneContent 的 title 得是字符串' }
  return {
    ok: true,
    content: {
      key: c.key,
      ...(c.params === undefined ? {} : { params: c.params as Record<string, unknown> }),
      ...(c.title === undefined ? {} : { title: c.title }),
    },
  }
}

/**
 * 上报内容 → 交给 dockview `updateParameters` 的那份（它是「并」，写 `undefined` 的键才删）。
 *
 * key 换成新的；给了 params 就整份换掉**件那半**——旧那半多出来的键写 `undefined`，保留键摘掉
 * 并出声。外壳那几个键（识别三件套、图标、预览）一个不碰：件改不动这一份的身份，也不因上报内容
 * 转正——那由件自己调 `keepPane` 决定。
 */
export function contentUpdateOf(
  prev: Record<string, unknown> | undefined,
  content: PaneContent,
): { update: Record<string, unknown>; notice?: string } {
  if (content.params === undefined) return { update: { key: content.key } }
  const reserved = shellParamKeysIn(content.params)
  const mine = pluginParamsIn(content.params) ?? {}
  const dropped = Object.keys(pluginParamsIn(prev) ?? {}).filter((k) => !Object.hasOwn(mine, k))
  return {
    update: { key: content.key, ...mine, ...Object.fromEntries(dropped.map((k) => [k, undefined])) },
    ...(reserved.length === 0 ? {} : { notice: `上报的 params 里 ${reserved.join('、')} 是外壳的保留键，已摘掉` }),
  }
}

/**
 * 一份参数的**稳定序列化**：比对「这一份的参数换了没有」用它，别拿对象引用比。
 *
 * 面板 params 每轮渲染都摘出一个新对象，引用永远是新的；而 params 本来就要求可 JSON
 * 序列化（它跟着布局落盘），所以序列化得出来。**键先排序**——同样的内容因为写的顺序
 * 不同而算出两个键，症状是无谓的重挂/软换，没有任何报错。
 */
export function paramsKeyOf(params: Record<string, unknown> | undefined): string {
  if (params === undefined) return ''
  const sorted = Object.keys(params).sort()
  return JSON.stringify(sorted.map((key) => [key, params[key]]))
}

