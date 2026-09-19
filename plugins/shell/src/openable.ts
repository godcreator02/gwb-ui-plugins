import { PLUGIN_COMPONENT, pluginParamsIn, shellParamKeysIn } from './panels.js'
import type { PaneKind, RegisteredPane } from './pane-registry.js'

export type { PaneKind } from './pane-registry.js'

/**
 * 「可以打开的窗格」那张表与开格的决策：注册表快照摊成井里能开的那几格（`listOpenable`
 * / `specForPane` / `specForOwnPane` 管**定义**），`targetGroup` 算落在哪一组、`planOpen`
 * 决定开成聚焦还是软换还是新开、`uniquePanelId` 管**实例**。判断吃的是**一张桌面的快照**
 * （`Desk`），零 DOM、零 react，测试在 node 里直接跑。
 *
 * 窗格 id 是 `plugin:<条目 id>:<窗格 id>`——同一个包挂两条条目时条目 id 分得开它们，
 * 同一条条目注册几格时窗格 id 分得开那几格。运行时注册下表里每一条自带身份，用不着
 * join、也用不着过滤（判据见文档站）。
 */

/**
 * 落进 dockview 面板的那份 `params`：外壳的识别三件套，加上件开这一份时传的那些键。
 * 两半并排住在一份里，保留键归外壳（名单在 `panels.ts`）。
 */
export interface PanelParams {
  pluginKey: string
  entryId: string
  paneId: string
  /**
   * 这一份**装的是什么**：件开格时给的那个不透明字符串，外壳只拿它找同一格的几份、
   * 不解释内容。件不给等于空串——「没给 key」不是特例。
   */
  key?: string
  /**
   * 这一份是不是**预览格**。只写 `true`，**转正就是把这个键删掉**，不写成 false
   * ——「有没有这个键」与「它是不是 true」两种判法并存的话，迟早有一处只判了其中一种。
   */
  preview?: boolean
  /** 件传的那半。键名由件定，撞上保留键的在入口就摘掉了 */
  [key: string]: unknown
}

/** 新窗格往哪放：`auto` 按目标组规则，`side` 开到来源旁边（见 `targetGroup`） */
export type Placement = 'auto' | 'side'

/**
 * 件调 `openPane` 时给的那几样。
 *
 * **`params` 必须可 JSON 序列化**：它跟着面板进 `api.toJSON()`、再整档写进 gwbData 的
 * `layout`，重启后原样喂给这一份的 `mountPane`。活对象（函数、DOM 节点、类实例）在那趟
 * 往返里会丢或者写坏，而且是重启之后才现形。
 */
export interface OpenPaneOptions {
  /**
   * 这一份装的是什么。**一格的身份是它装的内容**——外壳拿这个字符串去已开的几份里找
   * （文档窗格只找目标组，工具窗格找这张桌面），找得到就激活那一份。不透明：外壳一个字都
   * 不解释。不给等于空串。
   */
  key?: string
  /** 交给这一份的参数。走到聚焦时不作数、走到软换时原样换上（见 `planOpen`） */
  params?: Record<string, unknown>
  /**
   * 找不到时把内容放进目标组的**预览格**：那一组已经有这一格的预览格就原地换掉它的内容，
   * 没有就新开一份并标成预览格。**每组每一格至多一份预览格**。
   */
  preview?: boolean
  /** 往哪放，缺省 `auto`。认不出的值当 `auto` */
  placement?: Placement
}

/** 一格「可以打开的窗格」。`params` 是要落进 dockview 面板的那份 */
export interface OpenableSpec {
  /** 这是**基名**，不是某一份实例的 id。实例 id 由 `uniquePanelId` 算 */
  id: string
  component: string
  title: string
  icon?: string
  /** 工具窗格还是文档窗格。**从注册表现取、不进面板 params**——布局文件里没有它 */
  kind: PaneKind
  params: PanelParams
}

/** 桌面上一个标签（一份窗格实例）在判断里要看的那几样。`key` 与 `preview` 只在同一格之内比 */
export interface DeskTab {
  /** 这一份的 panel id */
  id: string
  entryId: string
  paneId: string
  /** 这一份装着什么（没给过就是空串） */
  key: string
  /** 这一份是不是预览格 */
  preview: boolean
}

/** 一组在页面上的矩形（px）。找侧边组只看它，所以嵌套成什么样都一样判 */
export interface GroupBox {
  x: number
  y: number
  w: number
  h: number
}

/** 桌面上的一组：一排标签共用的那一块 */
export interface DeskGroup {
  id: string
  /** 组里的标签，按标签条从左到右 */
  tabs: DeskTab[]
  /** 活动标签的 panel id。说不出就不给——新标签追加到末尾 */
  active?: string
  box: GroupBox
}

/**
 * `planOpen` 看的那一张桌面，由接线侧从这张桌面的井里现摘。**判断只看这一张**：别的桌面
 * 开着什么与它无关（本桌优先），跨桌的只有两样——实例 id 查重（`OpenContext.taken`），与工具
 * 窗格全页一份时去别的桌面找那一份（`OpenContext.elsewhere`）。
 */
export interface Desk {
  groups: DeskGroup[]
  /** 这张桌面的活动组 */
  activeGroup?: string
  /**
   * 组的最近激活顺序，最近的在前。只在运行时记、不落盘（重载后从空开始）；可能含已经
   * 没了的组，判断时跳过
   */
  recent: readonly string[]
}

/** 别的桌面上开着的那一份（工具窗格全页一份，打开时要去那儿找它） */
export interface OtherInstance {
  desktop: string
  id: string
  preview: boolean
}

/** 这一次打开的上下文。要开的是哪一类看定义自己的 `kind` */
export interface OpenContext {
  desk: Desk
  /** 来源窗格的实例 id。没有来源（状态栏、不带 from 的命令）就不给；不在这张桌面上等于没给 */
  from?: string
  /** 这个实例 id 在**任何一张桌面**上占着没有——实例 id 全页唯一 */
  taken: (id: string) => boolean
  /**
   * **别的桌面**上开着的同一定义、同一 key 的那一份（工具窗格全页一份，要去那儿找它）。不给等于
   * 别的桌面上都没有
   */
  elsewhere?: (def: PaneDef, key: string) => OtherInstance | undefined
}

/** 目标组：开进已有的一组、把一组对半分出新的一组、或者桌面是空的新建一组 */
export type Target = { group: string } | { split: string } | { empty: true }

/**
 * 窗格 id 的拼法：两段都进去，只有这一处这么拼，落盘的与表里的因此不会漂。拼出来的
 * 是**基名**——一格只开一份时它就是那份的 id，开第二份时由 `uniquePanelId` 在后面接。
 *
 * **拼出来的是个不透明的键**，别回头拆它。`entryId` 是 loader 给的条目全路径（实机
 * 是 `home:hello`，拼出来四段）；要 entryId 或 paneId 就从面板 `params` 里取，从来
 * 不必反解。
 */
export function panelIdOf(entryId: string, paneId: string): string {
  return `plugin:${entryId}:${paneId}`
}

/**
 * 基名 → 这一份实例的 id 与序号。第一份的 id 就是基名，第二份起接 `:2` / `:3`；
 * 序号一并回，不让调用方从 id 里拆。`taken` 由调用方给，node 里直接测得了。
 */
export function uniquePanelId(base: string, taken: (id: string) => boolean): { id: string; ordinal: number } {
  let ordinal = 1
  let id = base
  while (taken(id)) {
    ordinal += 1
    // 封顶：这个循环跑在 UI 线程上，`taken` 要是坏了恒回 true，窗口就整个冻住——
    // 而「冻住」是所有现象里最难往回查的一种。撞到这儿说明外壳自己坏了，抛出来
    if (ordinal > MAX_INSTANCES) throw new Error(`${base} 开到第 ${String(ordinal)} 份还在撞——查重坏了`)
    id = `${base}:${ordinal}`
  }
  return { id, ordinal }
}

/** 同一格最多开几份。数字本身不重要，它只是「查重坏了」的判据 */
const MAX_INSTANCES = 99

/** 第二份起标题带个序号——两份标题一模一样的话，人在标签条上分不出哪个是哪个 */
export function titleForOrdinal(title: string, ordinal: number): string {
  return ordinal <= 1 ? title : `${title} (${ordinal})`
}

/**
 * 新那份开在哪：开进某一组的第 `index` 个位置（活动标签的右边——dockview 的 openPanel
 * 不给 index 就追加到末尾，所以这儿显式算好）、把某一组对半分、或者空桌面新建一组。
 * **没有「不带参照」那一档**：只给方向的 position 在 dockview 那头贴的是整个容器的边，
 * 整片重新分宽。
 */
export type OpenAt = { group: string; index: number } | { split: string } | { empty: true }

/** 「件说打开某一格」之后该干什么。副作用留给调用方，这儿只出判断 */
export type OpenPlan =
  /** 激活这一份。`keep` 时顺带转正（正式打开命中了预览格） */
  | { kind: 'focus'; id: string; keep?: true; notice?: string }
  /**
   * 这一份（工具窗格，全页一份）开在**别的桌面**上：到那张桌面激活它，`keep` 同上。切不切过去归
   * 调用方——人点的（启动器）切过去，插件与命令开的只在那张桌面上激活、状态栏提示一句
   */
  | { kind: 'reveal'; desktop: string; id: string; keep?: true; notice?: string }
  /** 软换：这一格还是这一格，换掉它 params 里装的内容。`params` 是**整份**新的面板 params */
  | { kind: 'retarget'; id: string; params: PanelParams; notice?: string }
  | { kind: 'open'; id: string; title: string; spec: OpenableSpec; at: OpenAt; notice?: string }
  | { kind: 'none'; notice: string }

/**
 * 件传的那份参数并进面板 params，顺带按上这一份的身份（`key`，预览格再按一个 `preview`）。
 *
 * **外壳的三件套压在最上面**：保留键在这一步之前已由 `pluginParamsIn` 摘掉，这个展开
 * 顺序是第二道锁——件永远改不动这一格的身份。
 */
function withOpenParams(
  spec: OpenableSpec,
  params: Record<string, unknown> | undefined,
  key: string,
  preview: boolean,
): OpenableSpec {
  const mine = pluginParamsIn(params)
  return { ...spec, params: { ...mine, ...spec.params, key, ...(preview ? { preview: true } : {}) } }
}

/**
 * 落进 dockview 面板的那份 `params`：`spec` 那半，加上标签借道的 `icon`。
 *
 * **开格与软换同吃这一处**：两处各拼一份的话，软换那条会把 `icon` 拼漏——现象是换完
 * 内容标签上的图标变成了兜底那枚，而谁都不会想到是这儿。
 */
export function panelParamsOf(spec: OpenableSpec): PanelParams {
  return { ...spec.params, ...(spec.icon === undefined ? {} : { icon: spec.icon }) }
}

/** 窗格定义的键：注册表的 (条目 id, 窗格 id) */
export interface PaneDef {
  entryId: string
  paneId: string
}

function isDef(tab: DeskTab, def: PaneDef): boolean {
  return tab.entryId === def.entryId && tab.paneId === def.paneId
}

/**
 * 侧边组往右找多远算「紧挨着」（px）。实机组间缝是 8（外壳给 dockview 的 `gap`），
 * 余量吃掉亚像素摊分
 */
const SIDE_REACH = 16

/**
 * 某一组右边紧挨着的那一组：左边沿贴着它的右边沿、竖向跟它有重叠。好几组都挨着
 * （右边一列叠着好几组）取竖向重叠最多的，一样多取靠上的。没有回 undefined。
 */
export function sideGroupOf(desk: Desk, groupId: string): string | undefined {
  const base = desk.groups.find((g) => g.id === groupId)
  if (base === undefined) return undefined
  const right = base.box.x + base.box.w
  let best: { id: string; overlap: number; y: number } | undefined
  for (const g of desk.groups) {
    if (g.id === groupId) continue
    const dx = g.box.x - right
    if (dx < -1 || dx > SIDE_REACH) continue
    const overlap = Math.min(base.box.y + base.box.h, g.box.y + g.box.h) - Math.max(base.box.y, g.box.y)
    // 只擦到一个角的不算
    if (overlap <= 1) continue
    if (best === undefined || overlap > best.overlap || (overlap === best.overlap && g.box.y < best.y)) {
      best = { id: g.id, overlap, y: g.box.y }
    }
  }
  return best?.id
}

/** 这张桌面上装着这个实例的那一组 */
function groupHolding(desk: Desk, instanceId: string | undefined): DeskGroup | undefined {
  if (instanceId === undefined) return undefined
  return desk.groups.find((g) => g.tabs.some((t) => t.id === instanceId))
}

/** 这张桌面的活动组（说不出就取第一组） */
function activeGroupOf(desk: Desk): DeskGroup | undefined {
  return desk.groups.find((g) => g.id === desk.activeGroup) ?? desk.groups[0]
}

/** 开到基准组旁边：右边有侧边组就是它，没有就把基准组对半分 */
function beside(desk: Desk, base: DeskGroup): Target {
  const side = sideGroupOf(desk, base.id)
  return side === undefined ? { split: base.id } : { group: side }
}

/**
 * **目标组**：这次打开落在哪一组。只在一张桌面里算（有来源是来源那张，接线侧挑好）。
 *
 * `side`：基准组是来源所在的组（没有来源用活动组），右边有侧边组就是它，没有就对半分。
 *
 * `auto`，按顺序取第一个成立的：
 *
 * 1. 来源与要开的是同一个窗格定义 → 来源所在的组
 * 2. 这张桌面上有最近用过的同类组（最近激活、且装着这一格的实例）→ 那一组
 * 3. 有来源 → 照 `side` 算
 * 4. 有活动组 → 活动组
 * 5. 桌面是空的 → 新建一组
 */
export function targetGroup(desk: Desk, def: PaneDef, placement: Placement, from?: string): Target {
  const source = groupHolding(desk, from)
  if (placement === 'side') {
    const base = source ?? activeGroupOf(desk)
    return base === undefined ? { empty: true } : beside(desk, base)
  }
  const sourceTab = source?.tabs.find((t) => t.id === from)
  if (source !== undefined && sourceTab !== undefined && isDef(sourceTab, def)) return { group: source.id }
  for (const id of desk.recent) {
    const g = desk.groups.find((x) => x.id === id)
    if (g?.tabs.some((t) => isDef(t, def)) === true) return { group: g.id }
  }
  if (source !== undefined) return beside(desk, source)
  const active = activeGroupOf(desk)
  return active === undefined ? { empty: true } : { group: active.id }
}

/** 在别的桌面上找到的那一份 → reveal；它是预览格、这次是正式打开就顺带转正 */
function revealOf(there: OtherInstance, preview: boolean): OpenPlan {
  return {
    kind: 'reveal',
    desktop: there.desktop,
    id: there.id,
    ...(there.preview && !preview ? { keep: true as const } : {}),
  }
}

/** 开进已有的一组时插在哪：活动标签的右边，说不出活动标签就追加到末尾 */
function insertAt(group: DeskGroup): number {
  const active = group.tabs.findIndex((t) => t.id === group.active)
  return active < 0 ? group.tabs.length : active + 1
}

/**
 * 开格的**决策**：先算目标组，再按这一格是哪一类查重。副作用全留给调用方（`open.ts`）。
 *
 * ```
 * want = options.key ?? ''
 * 工具窗格：这张桌面任何一组里有同一格、key === want 的 → focus 它（不挪）
 *           本桌没有、别的桌面上有                      → reveal 它（全页一份，不在本桌再开）
 * 文档窗格：只在目标组里找同一格、key === want 的   → focus 它
 *   focus / reveal 时它是预览格、这次又是正式打开   → 顺带转正（keep）
 * 没找到，且要了 preview：
 *   目标组里有这一格的预览格                       → retarget 它（位置不动）
 *   没有                                          → open 一份新的并标成预览格
 * 没找到，且没要 preview                          → open 一份新的正式格
 * spec 认不出                                     → none
 * ```
 *
 * **文档窗格**同一内容在别的组、别的桌面开着都不算命中——本桌优先，能多开。**工具窗格全页一份**：
 * 本桌优先（老版本留下的多份里先挑本桌那份），本桌没有才去别的桌面找。打开本身不切桌面：reveal
 * 切不切过去归调用方。新开的插在目标组活动标签的右边。**参数不作用于聚焦**：走到聚焦时那一格装的
 * 本来就是这份内容，悄悄换掉面板 params 只会让盘上的档跟界面对不上。
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
  const def: PaneDef = { entryId: spec.params.entryId, paneId: spec.params.paneId }
  const want = options?.key ?? ''
  const preview = options?.preview === true
  const target = targetGroup(desk, def, options?.placement === 'side' ? 'side' : 'auto', context.from)
  const inTarget = 'group' in target ? desk.groups.find((g) => g.id === target.group) : undefined
  // 查重范围：工具窗格是整张桌面，文档窗格只是目标组
  const scope = spec.kind === 'tool' ? desk.groups.flatMap((g) => g.tabs) : (inTarget?.tabs ?? [])
  const already = scope.find((t) => isDef(t, def) && t.key === want)
  if (already !== undefined) {
    return already.preview && !preview ? { kind: 'focus', id: already.id, keep: true } : { kind: 'focus', id: already.id }
  }
  // 工具窗格全页一份：本桌没有就去别的桌面找
  const there = spec.kind === 'tool' ? context.elsewhere?.(def, want) : undefined
  if (there !== undefined) return revealOf(there, preview)
  const reserved = shellParamKeysIn(options?.params)
  const notice =
    reserved.length === 0 ? undefined : `窗格 ${who.paneId} 传的 params 里 ${reserved.join('、')} 是外壳的保留键，已摘掉`
  const next = withOpenParams(spec, options?.params, want, preview)
  // 预览格每组每一格至多一份：目标组里有就原地换掉它装的东西，格数不变
  const slot = preview ? inTarget?.tabs.find((t) => isDef(t, def) && t.preview) : undefined
  if (slot !== undefined) {
    return { kind: 'retarget', id: slot.id, params: panelParamsOf(next), ...(notice === undefined ? {} : { notice }) }
  }
  const { id, ordinal } = uniquePanelId(spec.id, context.taken)
  const at: OpenAt = 'group' in target ? { group: target.group, index: inTarget === undefined ? 0 : insertAt(inTarget) } : target
  return {
    kind: 'open',
    id,
    title: titleForOrdinal(spec.title, ordinal),
    spec: next,
    at,
    ...(notice === undefined ? {} : { notice }),
  }
}

/**
 * 状态栏「新建」（启动器）选了一条之后该干什么。没有来源、在当前桌面：
 *
 * - **文档窗格**：在活动组开一份**新的**（key 空串、不带参数，插件画它的默认内容），不查重
 * - **工具窗格**（全页一份）：本桌已有同一格（key 空串）就激活它；本桌没有、别的桌面上有就 reveal
 *   （启动器是人点的，调用方切过去）；是预览格就顺带转正；哪儿都没有就开进活动组
 *
 * 落点是**活动组**，不走 `targetGroup` 的「最近用过的同类组」——人在状态栏点的，「这儿」就是
 * 此刻激活的那一组。
 */
export function planLaunch(spec: OpenableSpec, context: OpenContext): OpenPlan {
  const { desk } = context
  const def: PaneDef = { entryId: spec.params.entryId, paneId: spec.params.paneId }
  if (spec.kind === 'tool') {
    const already = desk.groups.flatMap((g) => g.tabs).find((t) => isDef(t, def) && t.key === '')
    if (already !== undefined) {
      return already.preview ? { kind: 'focus', id: already.id, keep: true } : { kind: 'focus', id: already.id }
    }
    const there = context.elsewhere?.(def, '')
    if (there !== undefined) return revealOf(there, false)
  }
  const active = activeGroupOf(desk)
  const { id, ordinal } = uniquePanelId(spec.id, context.taken)
  return {
    kind: 'open',
    id,
    title: titleForOrdinal(spec.title, ordinal),
    spec: withOpenParams(spec, undefined, '', false),
    at: active === undefined ? { empty: true } : { group: active.id, index: insertAt(active) },
  }
}

/**
 * 送过去的这一份标题怎么带：件自己改过的（`setPaneTitle` / 上报内容给的）原样带过去；还是定义的
 * 缺省标题（`标题` 或 `标题 (n)`）就按新序号重算——带着旧序号过去，新桌面上会冒出一个对不上的「(4)」
 */
export function carriedTitle(old: string, base: string, ordinal: number): string {
  if (old === base) return titleForOrdinal(base, ordinal)
  const prefix = `${base} (`
  if (old.startsWith(prefix) && old.endsWith(')') && /^\d+$/.test(old.slice(prefix.length, -1))) {
    return titleForOrdinal(base, ordinal)
  }
  return old
}

/**
 * **送到别的桌面**之后在目标桌面怎么开（源桌面那份已由调用方关掉）。没有来源：
 *
 * - **工具窗格**：目标桌面已有同一格、同一 key 的就只激活那一份
 * - 否则按目标组规则（最近用过的同类组，否则活动组，桌面空就新建一组）开一份**正式**标签——
 *   预览不带过去，文档窗格目标组里有同一内容也照开（送过去就是「我要在这儿有它」）
 *
 * 带过去的是 key、件那半参数与标题（`carriedTitle`）。插件会被重新挂载，状态只靠参数带过去。
 */
export function planSend(
  spec: OpenableSpec,
  content: { key: string; params?: Record<string, unknown> },
  title: string,
  context: OpenContext,
): OpenPlan {
  const { desk } = context
  const def: PaneDef = { entryId: spec.params.entryId, paneId: spec.params.paneId }
  if (spec.kind === 'tool') {
    const already = desk.groups.flatMap((g) => g.tabs).find((t) => isDef(t, def) && t.key === content.key)
    if (already !== undefined) return { kind: 'focus', id: already.id }
  }
  const target = targetGroup(desk, def, 'auto')
  const inTarget = 'group' in target ? desk.groups.find((g) => g.id === target.group) : undefined
  const { id, ordinal } = uniquePanelId(spec.id, context.taken)
  return {
    kind: 'open',
    id,
    title: carriedTitle(title, spec.title, ordinal),
    spec: withOpenParams(spec, content.params, content.key, false),
    at: 'group' in target ? { group: target.group, index: inTarget === undefined ? 0 : insertAt(inTarget) } : target,
  }
}

/**
 * 对半分之后基准组的高该补成多少（逻辑尺寸）。没变（同一排里分，不用包分支）回 undefined。
 *
 * dockview 8.3.1 在「往右分一个竖排里的组」时要把它包进一个新的横向分支，而 `Gridview.addView`
 * 塞回去的尺寸是叶子**渲染后的高**（已经扣掉摊到的组间缝），不是它在那一排里的逻辑尺寸——
 * 分支于是少一份缝的摊额，多出来的流给同列的兄弟。补法：把基准组的高设成 `2×原高−现高`，
 * `setSize` 冒泡到外层那排设的正是分支的逻辑尺寸，渲染出来回到原高，那份摊额从当初吃下它的
 * 兄弟那儿原路扣回来（隔离 home 里量过二叠、三叠的上中下与竖根，兄弟组的宽高都回到原值）。
 */
export function splitHeightFix(before: number, after: number): number | undefined {
  return Math.abs(before - after) < 0.5 ? undefined : 2 * before - after
}

/** 表里一条 → 井里那一格的**定义**。列表与「打开我的某一格」同吃这一处，免得两边拼得不一样 */
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

/**
 * 件说「打开我的某一格」时开的是哪一条。**认不出就回 undefined**——调用方什么都不做：
 * 件写错一个字不该在井里凭空多出一格空白。
 *
 * 认的是「这条条目自己的那一格」：`entryId` 由服务那层填，件报不出别人的条目，
 * 也就打不开别人的窗格。
 */
export function specForOwnPane(
  panes: readonly RegisteredPane[],
  entryId: string,
  paneId: string,
): OpenableSpec | undefined {
  const found = panes.find((p) => p.entryId === entryId && p.id === paneId)
  return found === undefined ? undefined : specForPane(found)
}

/** 注册表 → 井里能开的那几格，按注册先后 */
export function listOpenable(panes: readonly RegisteredPane[]): OpenableSpec[] {
  return panes.map((pane) => specForPane(pane))
}

/**
 * 默认布局铺哪几格（第一次开机、存档恢复不了、「重置布局」）：表里有几格铺几格，但**工具窗格
 * 全页一份**——整页哪张桌面上已经开着它空 key 的那份就不再铺（不然重置桌面 2 会铺出第二份插件
 * 管理）。文档窗格照铺一份默认内容。`open` 是整页此刻开着的窗格（含没挂过的桌面落盘的那些）
 */
export function specsForDefaults(
  specs: readonly OpenableSpec[],
  open: readonly { entryId: string; paneId: string; key: string }[],
): OpenableSpec[] {
  return specs.filter(
    (spec) =>
      spec.kind === 'document' ||
      !open.some((e) => e.entryId === spec.params.entryId && e.paneId === spec.params.paneId && e.key === ''),
  )
}

/** 启动器里的一组：一条条目（一个插件）注册的那几格 */
export interface LauncherGroup {
  entryId: string
  /** 组名：件经 `describeSelf` 报的名字，没报就是包名 */
  title: string
  specs: OpenableSpec[]
}

/** 启动器按插件分组，组的先后跟注册先后走 */
export function groupForLauncher(
  specs: readonly OpenableSpec[],
  plugins: readonly { entryId: string; title: string }[],
): LauncherGroup[] {
  const groups = new Map<string, LauncherGroup>()
  for (const spec of specs) {
    const entryId = spec.params.entryId
    let group = groups.get(entryId)
    if (group === undefined) {
      const title = plugins.find((p) => p.entryId === entryId)?.title ?? spec.params.pluginKey
      group = { entryId, title, specs: [] }
      groups.set(entryId, group)
    }
    group.specs.push(spec)
  }
  return [...groups.values()]
}
