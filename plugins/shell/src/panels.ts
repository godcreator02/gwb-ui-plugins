/** 插件窗格的 component 名（COMPONENTS 表里的键） */
export const PLUGIN_COMPONENT = 'plugin'

/** dockview 面板上本模块要看的那部分形状 */
export interface PanelLike {
  view?: { contentComponent?: unknown }
  params?: Record<string, unknown> | undefined
}

/** 按 `view.contentComponent` 判，不按 id：id 是调用方起的名字 */
export function isPluginPanel(panel: PanelLike | null | undefined): boolean {
  return panel?.view?.contentComponent === PLUGIN_COMPONENT
}

/** 不是插件窗格、或 params 里这一项不是字符串，都回空串 */
function stringParamOfPluginPanel(panel: PanelLike | null | undefined, paramName: string): string {
  if (!isPluginPanel(panel)) return ''
  const value = panel?.params?.[paramName]
  return typeof value === 'string' ? value : ''
}

/** 完整包名；认不出回空串，调用方拿到空串就跳过 */
export function pluginKeyOf(panel: PanelLike | null | undefined): string {
  return stringParamOfPluginPanel(panel, 'pluginKey')
}

/** 认不出回空串：params 缺这一项是外壳的 bug，不判就会不报错地匹配到错的窗格 */
export function entryIdOf(panel: PanelLike | null | undefined): string {
  return stringParamOfPluginPanel(panel, 'entryId')
}

/** `registerPane` 给的窗格 id；认不出回空串 */
export function paneIdOf(panel: PanelLike | null | undefined): string {
  return stringParamOfPluginPanel(panel, 'paneId')
}

/** 这一份装的内容；认不出回空串，而空串是正当的值——没给 key 就等于给了空串 */
export function paneKeyOf(panel: PanelLike | null | undefined): string {
  return stringParamOfPluginPanel(panel, 'key')
}

/** 判 `=== true`：正式窗格身上没有这个键 */
export function isPreviewPanel(panel: PanelLike | null | undefined): boolean {
  if (!isPluginPanel(panel)) return false
  return panel?.params?.preview === true
}

/** 外壳占用的 params 键；插件的参数与它们放在同一份 params 里，放进面板前与交给插件前各移除一次 */
export const SHELL_PARAM_KEYS = ['pluginKey', 'entryId', 'paneId', 'icon', 'key', 'preview'] as const

const SHELL_PARAM_KEY_SET = new Set<string>(SHELL_PARAM_KEYS)

/** 用了保留键的那几个名字，按给的顺序；移除时要告警，否则插件那头查不到参数为什么没到 */
export function shellParamKeysIn(params: Record<string, unknown> | undefined): string[] {
  if (params === undefined) return []
  return Object.keys(params).filter((key) => SHELL_PARAM_KEY_SET.has(key))
}

/** 移除保留键后插件自己的那部分；一个键都不剩回 undefined，插件据此判断「开这一份时没给参数」 */
export function pluginParamsIn(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (params === undefined) return undefined
  const pluginEntries = Object.entries(params).filter(([key]) => !SHELL_PARAM_KEY_SET.has(key))
  return pluginEntries.length === 0 ? undefined : Object.fromEntries(pluginEntries)
}

/** 旧那份里 `replacement` 没有的键写成 `undefined`：dockview 的 updateParameters 是合并，只删值为 undefined 的键 */
function undefinedForKeysMissingFrom(previous: Record<string, unknown>, replacement: Record<string, unknown>): Record<string, undefined> {
  const droppedKeys = Object.keys(previous).filter((key) => !Object.hasOwn(replacement, key))
  return Object.fromEntries(droppedKeys.map((key) => [key, undefined]))
}

/** 用 `next` 整份替换 `prev` 时交给 `api.updateParameters` 的那份 */
export function replaceParams(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  if (prev === undefined) return next
  return { ...undefinedForKeysMissingFrom(prev, next), ...next }
}

/** 平对象且能 JSON 序列化：参数随布局保存，循环引用在这里拦下，免得写坏布局文件 */
export function isPlainParams(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  try {
    JSON.stringify(value)
  } catch {
    return false
  }
  return true
}

/** 插件经 `setPaneContent` 上报的：这个窗格此刻装的内容 */
export interface PaneContent {
  /** 同 `openPane` 的 key，不透明 */
  key: string
  /** 给了就整份替换插件自己的那部分参数；不给就不动 */
  params?: Record<string, unknown>
  /** 给了等于顺带 `setPaneTitle` */
  title?: string
}

/** 插件上报的内容在这里校验形状 */
export function parsePaneContent(raw: unknown): { ok: true; content: PaneContent } | { ok: false; error: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'setPaneContent 要一个 { key, params?, title? } 对象' }
  }
  const reported = raw as { key?: unknown; params?: unknown; title?: unknown }
  if (typeof reported.key !== 'string') return { ok: false, error: 'setPaneContent 的 key 得是字符串（此刻装的内容）' }
  if (reported.params !== undefined && !isPlainParams(reported.params)) {
    return { ok: false, error: 'setPaneContent 的 params 得是平对象且可 JSON 序列化（它随布局保存）' }
  }
  if (reported.title !== undefined && typeof reported.title !== 'string') return { ok: false, error: 'setPaneContent 的 title 得是字符串' }
  return {
    ok: true,
    content: {
      key: reported.key,
      ...(reported.params === undefined ? {} : { params: reported.params as Record<string, unknown> }),
      ...(reported.title === undefined ? {} : { title: reported.title }),
    },
  }
}

/**
 * 上报内容 → 交给 `updateParameters` 的那份：换 key；给了 params 就整份替换插件那部分、移除保留键并告警。
 * 外壳的身份字段与 preview 不动：上报内容不会让预览窗格转成正式窗格，要转由插件自己调 `keepPane`
 */
export function contentUpdateOf(
  prev: Record<string, unknown> | undefined,
  content: PaneContent,
): { update: Record<string, unknown>; notice?: string } {
  if (content.params === undefined) return { update: { key: content.key } }
  const reservedKeysPassed = shellParamKeysIn(content.params)
  const reportedPluginParams = pluginParamsIn(content.params) ?? {}
  const previousPluginParams = pluginParamsIn(prev) ?? {}
  return {
    update: { key: content.key, ...reportedPluginParams, ...undefinedForKeysMissingFrom(previousPluginParams, reportedPluginParams) },
    ...(reservedKeysPassed.length === 0 ? {} : { notice: `上报的 params 里 ${reservedKeysPassed.join('、')} 是外壳的保留键，已摘掉` }),
  }
}

/** 稳定序列化，比对参数换没换用它、不比对象引用；键先排序，写的顺序不同不算换了 */
export function paramsKeyOf(params: Record<string, unknown> | undefined): string {
  if (params === undefined) return ''
  const sortedKeys = Object.keys(params).sort()
  return JSON.stringify(sortedKeys.map((key) => [key, params[key]]))
}
