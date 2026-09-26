import { PLUGIN_COMPONENT, pluginParamsIn, shellParamKeysIn } from './panels.js'
import type { PaneKind, RegisteredPane } from './pane-registry.js'

export type { PaneKind } from './pane-registry.js'

/** dockview 面板上的 `params`：外壳的身份字段加插件自己传的键，保留键名单在 `panels.ts` */
export interface PanelParams {
  pluginKey: string
  entryId: string
  paneId: string
  /** 这一份装的内容：插件给的不透明字符串，外壳只拿它查重；没给等于空串 */
  key?: string
  /** 只写 `true`，转正就是删掉这个键，不写成 false——两种判法并存迟早有一处只判了一种 */
  preview?: boolean
  /** 插件传的那部分，与保留键重名的在入口已移除 */
  [key: string]: unknown
}

/** `auto` 按目标组规则，`side` 开到来源旁边（见 `targetGroup`） */
export type Placement = 'auto' | 'side'

/** 插件调 `openPane` 时给的选项 */
export interface OpenPaneOptions {
  /** 这一份装的内容，外壳不解释；已开的几份里找得到就激活那一份（文档窗格只找目标组，工具窗格找这张桌面）。不给等于空串 */
  key?: string
  /** 必须可 JSON 序列化：它随布局保存、重启后原样交给 `mountPane`。聚焦时不生效，软换时整份换上 */
  params?: Record<string, unknown>
  /** 找不到时放进目标组的预览窗格：已有就原地换内容，没有就新开一份标成预览。每组每个窗格至多一份 */
  preview?: boolean
  /** 缺省 `auto`，认不出的值当 `auto` */
  placement?: Placement
}

/** 一个可以打开的窗格定义；`params` 是要放到 dockview 面板上的那份 */
export interface OpenableSpec {
  /** 基名，不是实例 id；实例 id 由 `uniquePanelId` 算 */
  id: string
  component: string
  title: string
  icon?: string
  /** 从注册表取，不进面板 params，布局文件里没有它 */
  kind: PaneKind
  params: PanelParams
}

/** 桌面上一个标签（一份窗格实例）里判断要看的那几样 */
export interface DeskTab {
  /** panel id */
  id: string
  entryId: string
  paneId: string
  /** 没给过就是空串 */
  key: string
  preview: boolean
}

/** 组在页面上的矩形（px） */
export interface GroupBox {
  x: number
  y: number
  w: number
  h: number
}

export interface DeskGroup {
  id: string
  /** 按标签条从左到右 */
  tabs: DeskTab[]
  /** 活动标签的 panel id；说不出就不给，新标签追加到末尾 */
  active?: string
  box: GroupBox
}

/** 一张桌面的快照，由执行侧从这张桌面的容器当场读取 */
export interface Desk {
  groups: DeskGroup[]
  activeGroup?: string
  /** 组的最近激活顺序，最近的在前；只在运行时记，可能含已经不在的组 */
  recent: readonly string[]
}

/** 别的桌面上开着的那一份 */
export interface OtherInstance {
  desktop: string
  id: string
  preview: boolean
}

export interface OpenContext {
  desk: Desk
  /** 来源窗格的实例 id；不在这张桌面上等于没给 */
  from?: string
  /** 这个实例 id 在任何一张桌面上是否已占用 */
  taken: (id: string) => boolean
  /** 别的桌面上开着的同一定义、同一 key 的那一份；不给等于别的桌面上都没有 */
  elsewhere?: (def: PaneDef, key: string) => OtherInstance | undefined
}

/** 开进已有的一组、把一组对半分出新组、或空桌面新建一组 */
export type Target = { group: string } | { split: string } | { empty: true }

/** 拼出的是不透明的基名，别拆它：entryId 自带冒号，要 entryId 或 paneId 从面板 params 取 */
export function panelIdOf(entryId: string, paneId: string): string {
  return `plugin:${entryId}:${paneId}`
}

/** 查重坏了的判据，数字本身不重要 */
const MAX_INSTANCES_PER_PANE = 99

/** 第一份的 id 就是基名，第二份起接 `:2` / `:3`；序号一并返回，调用方不必从 id 里拆 */
export function uniquePanelId(base: string, taken: (id: string) => boolean): { id: string; ordinal: number } {
  let ordinal = 1
  let id = base
  while (taken(id)) {
    ordinal += 1
    // 循环跑在 UI 线程上：`taken` 坏了恒回 true 会冻住整个窗口，所以设上限、抛出来
    if (ordinal > MAX_INSTANCES_PER_PANE) throw new Error(`${base} 开到第 ${String(ordinal)} 份还在撞——查重坏了`)
    id = `${base}:${ordinal}`
  }
  return { id, ordinal }
}

export function titleForOrdinal(title: string, ordinal: number): string {
  return ordinal <= 1 ? title : `${title} (${ordinal})`
}

/** 新的一份放在哪：某一组的第 `index` 个位置、把某一组对半分、或空桌面新建一组。没有不带参照的放法 */
export type OpenAt = { group: string; index: number } | { split: string } | { empty: true }

/** 打开一个窗格该做什么；副作用归调用方（`open.ts`） */
export type OpenPlan =
  /** `keep`：顺带转正 */
  | { kind: 'focus'; id: string; keep?: true; notice?: string }
  /** 工具窗格开在别的桌面上：到那张桌面激活它；切不切过去归调用方 */
  | { kind: 'reveal'; desktop: string; id: string; keep?: true; notice?: string }
  /** 软换：`params` 是整份新的面板 params */
  | { kind: 'retarget'; id: string; params: PanelParams; notice?: string }
  | { kind: 'open'; id: string; title: string; spec: OpenableSpec; at: OpenAt; notice?: string }
  | { kind: 'none'; notice: string }

/** 外壳的身份字段展开在后面：保留键此前已由 `pluginParamsIn` 移除，这是第二道保证 */
function withPluginParamsAndIdentity(
  spec: OpenableSpec,
  params: Record<string, unknown> | undefined,
  key: string,
  preview: boolean,
): OpenableSpec {
  const pluginParams = pluginParamsIn(params)
  return { ...spec, params: { ...pluginParams, ...spec.params, key, ...(preview ? { preview: true } : {}) } }
}

/** 开窗格与软换都用这一处拼，分开拼的话软换会漏掉 `icon` */
export function panelParamsOf(spec: OpenableSpec): PanelParams {
  return { ...spec.params, ...(spec.icon === undefined ? {} : { icon: spec.icon }) }
}

/** 窗格定义的键：注册表的 (条目 id, 窗格 id) */
export interface PaneDef {
  entryId: string
  paneId: string
}

function paneDefOf(spec: OpenableSpec): PaneDef {
  return { entryId: spec.params.entryId, paneId: spec.params.paneId }
}

function tabIsOfPane(tab: DeskTab, def: PaneDef): boolean {
  return tab.entryId === def.entryId && tab.paneId === def.paneId
}

/** 组间缝是 8（外壳给 dockview 的 `gap`），多出的余量容纳亚像素分摊 */
const SIDE_GROUP_MAX_GAP_PX = 16

/**
 * 右边紧挨着的那一组：左边沿贴着基准组的右边沿、竖向有重叠。好几组都挨着取重叠最多的，
 * 一样多取靠上的；没有回 undefined
 */
export function sideGroupOf(desk: Desk, groupId: string): string | undefined {
  const baseGroup = desk.groups.find((group) => group.id === groupId)
  if (baseGroup === undefined) return undefined
  const baseRightEdge = baseGroup.box.x + baseGroup.box.w
  let bestNeighbour: { id: string; overlap: number; y: number } | undefined
  for (const group of desk.groups) {
    if (group.id === groupId) continue
    const gapToBase = group.box.x - baseRightEdge
    if (gapToBase < -1 || gapToBase > SIDE_GROUP_MAX_GAP_PX) continue
    const overlap = Math.min(baseGroup.box.y + baseGroup.box.h, group.box.y + group.box.h) - Math.max(baseGroup.box.y, group.box.y)
    // 只擦到一个角的不算
    if (overlap <= 1) continue
    if (bestNeighbour === undefined || overlap > bestNeighbour.overlap || (overlap === bestNeighbour.overlap && group.box.y < bestNeighbour.y)) {
      bestNeighbour = { id: group.id, overlap, y: group.box.y }
    }
  }
  return bestNeighbour?.id
}

function groupHoldingInstance(desk: Desk, instanceId: string | undefined): DeskGroup | undefined {
  if (instanceId === undefined) return undefined
  return desk.groups.find((group) => group.tabs.some((tab) => tab.id === instanceId))
}

/** 说不出活动组就取第一组 */
function activeGroupOf(desk: Desk): DeskGroup | undefined {
  return desk.groups.find((group) => group.id === desk.activeGroup) ?? desk.groups[0]
}

function besideGroup(desk: Desk, baseGroup: DeskGroup): Target {
  const sideGroup = sideGroupOf(desk, baseGroup.id)
  return sideGroup === undefined ? { split: baseGroup.id } : { group: sideGroup }
}

function recentGroupHoldingPane(desk: Desk, def: PaneDef): DeskGroup | undefined {
  for (const groupId of desk.recent) {
    const group = desk.groups.find((candidate) => candidate.id === groupId)
    if (group?.tabs.some((tab) => tabIsOfPane(tab, def)) === true) return group
  }
  return undefined
}

/**
 * 这次打开落在哪一组，只在一张桌面里算。`side`：来源窗格所在组（没有来源取活动组）右边紧挨的那组，没有就把它对半分。
 * `auto` 依次取：来源就是这个窗格时的来源组、最近激活过且开着这个窗格的组、来源组旁边、活动组；桌面是空的就新建一组
 */
export function targetGroup(desk: Desk, def: PaneDef, placement: Placement, from?: string): Target {
  const sourceGroup = groupHoldingInstance(desk, from)
  if (placement === 'side') {
    const baseGroup = sourceGroup ?? activeGroupOf(desk)
    return baseGroup === undefined ? { empty: true } : besideGroup(desk, baseGroup)
  }
  const sourceTab = sourceGroup?.tabs.find((tab) => tab.id === from)
  if (sourceGroup !== undefined && sourceTab !== undefined && tabIsOfPane(sourceTab, def)) return { group: sourceGroup.id }
  const recentGroup = recentGroupHoldingPane(desk, def)
  if (recentGroup !== undefined) return { group: recentGroup.id }
  if (sourceGroup !== undefined) return besideGroup(desk, sourceGroup)
  const activeGroup = activeGroupOf(desk)
  return activeGroup === undefined ? { empty: true } : { group: activeGroup.id }
}

/** 找到的是预览窗格、这次是正式打开就顺带转正 */
function focusPlanFor(tab: DeskTab, wantsPreview: boolean): OpenPlan {
  return tab.preview && !wantsPreview ? { kind: 'focus', id: tab.id, keep: true } : { kind: 'focus', id: tab.id }
}

function revealPlanFor(openElsewhere: OtherInstance, wantsPreview: boolean): OpenPlan {
  return {
    kind: 'reveal',
    desktop: openElsewhere.desktop,
    id: openElsewhere.id,
    ...(openElsewhere.preview && !wantsPreview ? { keep: true as const } : {}),
  }
}

/** 活动标签的右边，说不出活动标签就追加到末尾 */
function indexRightOfActiveTab(group: DeskGroup): number {
  const activeIndex = group.tabs.findIndex((tab) => tab.id === group.active)
  return activeIndex < 0 ? group.tabs.length : activeIndex + 1
}

/** `targetGroup` 给的组都取自这张快照，目标是某一组时 `groupInDesk` 一定在 */
function openAtTarget(target: Target, groupInDesk: DeskGroup | undefined): OpenAt {
  if (!('group' in target)) return target
  if (groupInDesk === undefined) throw new Error(`目标组 ${target.group} 不在这张桌面的快照里`)
  return { group: target.group, index: indexRightOfActiveTab(groupInDesk) }
}

function groupOfTarget(desk: Desk, target: Target): DeskGroup | undefined {
  return 'group' in target ? desk.groups.find((group) => group.id === target.group) : undefined
}

/** 工具窗格查整张桌面，文档窗格只查目标组 */
function alreadyOpenTab(spec: OpenableSpec, desk: Desk, groupInDesk: DeskGroup | undefined, wantedKey: string): DeskTab | undefined {
  const def = paneDefOf(spec)
  const tabsToSearch = spec.kind === 'tool' ? desk.groups.flatMap((group) => group.tabs) : (groupInDesk?.tabs ?? [])
  return tabsToSearch.find((tab) => tabIsOfPane(tab, def) && tab.key === wantedKey)
}

function reservedKeysNotice(options: OpenPaneOptions | undefined, who: PaneDef): string | undefined {
  const reservedKeysPassed = shellParamKeysIn(options?.params)
  return reservedKeysPassed.length === 0 ? undefined : `窗格 ${who.paneId} 传的 params 里 ${reservedKeysPassed.join('、')} 是外壳的保留键，已摘掉`
}

/**
 * 先算目标组，再按窗格类别查重：同一 key 已经开着（工具窗格查整张桌面，文档窗格只查目标组）就激活它，正式打开时找到的是
 * 预览窗格就顺带转正；工具窗格开在别的桌面上就到那张桌面激活它；要预览、目标组里已有这个窗格的预览窗格就原地换内容；
 * 都不是才开新的一份
 */
export function planOpen(
  spec: OpenableSpec | undefined,
  options: OpenPaneOptions | undefined,
  context: OpenContext,
  who: PaneDef,
): OpenPlan {
  if (spec === undefined) {
    return { kind: 'none', notice: `条目 ${who.entryId} 要开的窗格 ${who.paneId} 不在注册表里` }
  }
  const { desk } = context
  const def = paneDefOf(spec)
  const wantedKey = options?.key ?? ''
  const wantsPreview = options?.preview === true
  const target = targetGroup(desk, def, options?.placement === 'side' ? 'side' : 'auto', context.from)
  const groupInDesk = groupOfTarget(desk, target)
  const alreadyOpen = alreadyOpenTab(spec, desk, groupInDesk, wantedKey)
  if (alreadyOpen !== undefined) return focusPlanFor(alreadyOpen, wantsPreview)
  const openElsewhere = spec.kind === 'tool' ? context.elsewhere?.(def, wantedKey) : undefined
  if (openElsewhere !== undefined) return revealPlanFor(openElsewhere, wantsPreview)
  const notice = reservedKeysNotice(options, who)
  const specWithParams = withPluginParamsAndIdentity(spec, options?.params, wantedKey, wantsPreview)
  const previewTabInTarget = wantsPreview ? groupInDesk?.tabs.find((tab) => tabIsOfPane(tab, def) && tab.preview) : undefined
  if (previewTabInTarget !== undefined) {
    return { kind: 'retarget', id: previewTabInTarget.id, params: panelParamsOf(specWithParams), ...(notice === undefined ? {} : { notice }) }
  }
  const { id, ordinal } = uniquePanelId(spec.id, context.taken)
  return {
    kind: 'open',
    id,
    title: titleForOrdinal(spec.title, ordinal),
    spec: specWithParams,
    at: openAtTarget(target, groupInDesk),
    ...(notice === undefined ? {} : { notice }),
  }
}

/**
 * 启动器选了一条之后做什么。落点是活动组，不走「最近用过的同类组」；文档窗格一律开新的，
 * 工具窗格本桌有就激活、别的桌面有就 reveal
 */
export function planLaunch(spec: OpenableSpec, context: OpenContext): OpenPlan {
  const { desk } = context
  const def = paneDefOf(spec)
  if (spec.kind === 'tool') {
    const alreadyOpen = desk.groups.flatMap((group) => group.tabs).find((tab) => tabIsOfPane(tab, def) && tab.key === '')
    if (alreadyOpen !== undefined) return focusPlanFor(alreadyOpen, false)
    const openElsewhere = context.elsewhere?.(def, '')
    if (openElsewhere !== undefined) return revealPlanFor(openElsewhere, false)
  }
  const activeGroup = activeGroupOf(desk)
  const { id, ordinal } = uniquePanelId(spec.id, context.taken)
  return {
    kind: 'open',
    id,
    title: titleForOrdinal(spec.title, ordinal),
    spec: withPluginParamsAndIdentity(spec, undefined, '', false),
    at: activeGroup === undefined ? { empty: true } : { group: activeGroup.id, index: indexRightOfActiveTab(activeGroup) },
  }
}

/** 插件改过的标题原样带过去；还是缺省标题（`标题` 或 `标题 (n)`）就按新序号重算 */
export function carriedTitle(old: string, base: string, ordinal: number): string {
  if (old === base) return titleForOrdinal(base, ordinal)
  const prefix = `${base} (`
  if (old.startsWith(prefix) && old.endsWith(')') && /^\d+$/.test(old.slice(prefix.length, -1))) {
    return titleForOrdinal(base, ordinal)
  }
  return old
}

/**
 * 送到别的桌面后在目标桌面怎么开（源桌面那份调用方已关掉）：工具窗格目标桌面已有同一 key 的就只激活它，
 * 否则按目标组规则开一份正式标签，预览不带过去
 */
export function planSend(
  spec: OpenableSpec,
  content: { key: string; params?: Record<string, unknown> },
  title: string,
  context: OpenContext,
): OpenPlan {
  const { desk } = context
  const def = paneDefOf(spec)
  if (spec.kind === 'tool') {
    const alreadyOpen = desk.groups.flatMap((group) => group.tabs).find((tab) => tabIsOfPane(tab, def) && tab.key === content.key)
    if (alreadyOpen !== undefined) return { kind: 'focus', id: alreadyOpen.id }
  }
  const target = targetGroup(desk, def, 'auto')
  const groupInDesk = groupOfTarget(desk, target)
  const { id, ordinal } = uniquePanelId(spec.id, context.taken)
  return {
    kind: 'open',
    id,
    title: carriedTitle(title, spec.title, ordinal),
    spec: withPluginParamsAndIdentity(spec, content.params, content.key, false),
    at: openAtTarget(target, groupInDesk),
  }
}

/**
 * 对半分之后基准组的高补成多少（逻辑尺寸），没变回 undefined。dockview 把竖排里的组包进新分支时
 * 塞回的是渲染后的高，补成 `2×原高−现高` 就回到原高
 */
export function splitHeightFix(before: number, after: number): number | undefined {
  return Math.abs(before - after) < 0.5 ? undefined : 2 * before - after
}

/** 列表与「打开我的某个窗格」都用这一处拼定义 */
export function specForPane(pane: RegisteredPane): OpenableSpec {
  return {
    id: panelIdOf(pane.entryId, pane.id),
    component: PLUGIN_COMPONENT,
    title: pane.title,
    ...(pane.icon === undefined ? {} : { icon: pane.icon }),
    kind: pane.kind,
    params: { pluginKey: pane.pkg, entryId: pane.entryId, paneId: pane.id },
  }
}

/** 只认这条条目自己的窗格；认不出回 undefined，调用方什么都不做 */
export function specForOwnPane(
  panes: readonly RegisteredPane[],
  entryId: string,
  paneId: string,
): OpenableSpec | undefined {
  const ownPane = panes.find((pane) => pane.entryId === entryId && pane.id === paneId)
  return ownPane === undefined ? undefined : specForPane(ownPane)
}

/** 按注册先后 */
export function listOpenable(panes: readonly RegisteredPane[]): OpenableSpec[] {
  return panes.map((pane) => specForPane(pane))
}

/**
 * 默认布局打开哪几个：表里有几个开几个，但工具窗格整页任何一张桌面上已开着空 key 的那份就不再开。
 * `open` 是整页此刻开着的窗格，含没挂载过的桌面在布局文件里的那些
 */
export function specsForDefaults(
  specs: readonly OpenableSpec[],
  open: readonly { entryId: string; paneId: string; key: string }[],
): OpenableSpec[] {
  return specs.filter(
    (spec) =>
      spec.kind === 'document' ||
      !open.some((entry) => entry.entryId === spec.params.entryId && entry.paneId === spec.params.paneId && entry.key === ''),
  )
}

/** 启动器里一个插件（一条条目）注册的那几个窗格 */
export interface LauncherGroup {
  entryId: string
  /** 插件经 `describeSelf` 报的名字，没报就是包名 */
  title: string
  specs: OpenableSpec[]
}

/** 组的先后跟注册先后走 */
export function groupForLauncher(
  specs: readonly OpenableSpec[],
  plugins: readonly { entryId: string; title: string }[],
): LauncherGroup[] {
  const groupsByEntryId = new Map<string, LauncherGroup>()
  for (const spec of specs) {
    const entryId = spec.params.entryId
    let group = groupsByEntryId.get(entryId)
    if (group === undefined) {
      const title = plugins.find((plugin) => plugin.entryId === entryId)?.title ?? spec.params.pluginKey
      group = { entryId, title, specs: [] }
      groupsByEntryId.set(entryId, group)
    }
    group.specs.push(spec)
  }
  return [...groupsByEntryId.values()]
}
