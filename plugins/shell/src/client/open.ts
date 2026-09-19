import type { DockviewApi } from 'dockview-react'
import {
  panelParamsOf,
  planOpen,
  specForOwnPane,
  splitHeightFix,
  titleForOrdinal,
  uniquePanelId,
  type OpenableSpec,
  type OpenContext,
  type OpenPaneOptions,
  type OpenPlan,
  type PaneKind,
} from '../openable.js'
import { replaceParams } from '../panels.js'
import { fetchPanes } from './panes.js'
import { wellHub } from './well-hub.js'
import type { HostBridge } from './types.js'

/**
 * 开格的**执行层**：判断全在纯函数 `planOpen`（`openable.ts`），这儿只挑桌面、摘快照、
 * 按判断分派成 dockview 的动作——聚焦（顺带转正）、软换、开进某一组、对半分。
 *
 * **打开从来不切桌面**：有来源就开在来源那张桌面上，否则开在当前桌面；那张桌面藏着也
 * 照开，当前显示哪张不变。
 */

/** 注册表里还没有「这一格是哪一类」这一项：一律按缺省的工具窗格判 */
const KIND: PaneKind = 'tool'

/** 这一条 spec 背后是谁的哪一格 */
function whoOf(spec: OpenableSpec): { entryId: string; paneId: string } {
  return { entryId: spec.params.entryId, paneId: spec.params.paneId }
}

/** 在这张桌面上判的上下文。井还没挂上回 undefined */
function contextOn(desktop: string, from: string | undefined): OpenContext | undefined {
  const desk = wellHub.deskOf(desktop)
  if (desk === undefined) return undefined
  return {
    desk,
    kind: KIND,
    taken: (id) => wellHub.takenAnywhere(id),
    ...(from === undefined ? {} : { from }),
  }
}

/**
 * 状态栏那张表上点这一条会不会走成**聚焦**——「已开」记号标的就是它。问的就是
 * `planOpen` 自己（当前桌面、没有来源）：另写一条「开着没有」就是第二份真相，记号会开始说谎。
 */
export function willFocus(spec: OpenableSpec): boolean {
  const context = contextOn(wellHub.activeDesktop(), undefined)
  return context !== undefined && planOpen(spec, undefined, context, whoOf(spec)).kind === 'focus'
}

/** dockview 的标签组件表按键取用，开格时 `tabComponent` 指到这个键 */
export const TAB_COMPONENT = 'gwb-tab'

/**
 * 开一格：算出这一份的实例 id 再 `addPanel`（撞已存在的 id 是同步抛，id 必须先算好）。
 * 查重看全井——实例 id 全页唯一，第二份在任何一口井都叫 `:2`。默认布局、重置布局走这条：
 * 全开进活动组当兄弟标签，不新建组。
 */
export function addInstance(api: DockviewApi, spec: OpenableSpec): void {
  const { id, ordinal } = uniquePanelId(spec.id, (candidate) => wellHub.takenAnywhere(candidate))
  api.addPanel({
    id,
    component: spec.component,
    tabComponent: TAB_COMPONENT,
    title: titleForOrdinal(spec.title, ordinal),
    params: panelParamsOf(spec),
  })
}

/**
 * 开一格（注册表认身份）。`who` 吃注册表的键 (entryId, 窗格 id)——件的桥上传的是面板
 * 闭包绑好的自己那条目，跨件开格（`shell.openPane` 转进来的动作）传谁的开谁的。`from` 是
 * 来源窗格的实例 id：桥上是调用的那一份自己，命令上是调用方给的；**哪张桌面都找不到就当
 * 没有来源**、开在当前桌面。表现取不用快照——件是热挂载的，快照里没有后挂的件。
 *
 * `await` 之后**摘快照、算 id 与 addPanel 必须在同一个同步段里**：中间再插一次 await，
 * 两次并发的 openPane 会算出同一个 id，第二个 addPanel 当场抛。
 */
export async function openRegisteredPane(
  host: HostBridge,
  who: { entryId: string; paneId: string },
  options: OpenPaneOptions | undefined,
  from?: string,
): Promise<void> {
  const panes = await fetchPanes(host)
  const located = from === undefined ? undefined : wellHub.locate(from)
  if (from !== undefined && located === undefined) {
    console.warn(`[shell] 开 ${who.entryId} 的 ${who.paneId}：来源窗格 ${from} 哪张桌面都没有，当没有来源、开在当前桌面`)
  }
  openOn(
    located ?? wellHub.activeDesktop(),
    specForOwnPane(panes, who.entryId, who.paneId),
    options,
    who,
    located === undefined ? undefined : from,
  )
}

/**
 * 外壳自己开一格（状态栏那张「可开的窗格」列表点的就是这条）。**走跟件调 `openPane`
 * 同一个 `planOpen`**，只是没有来源、开在当前桌面：本桌已开就激活，没开就开进活动组。
 */
export function openSpec(spec: OpenableSpec): void {
  openOn(wellHub.activeDesktop(), spec, undefined, whoOf(spec), undefined)
}

function openOn(
  desktop: string,
  spec: OpenableSpec | undefined,
  options: OpenPaneOptions | undefined,
  who: { entryId: string; paneId: string },
  from: string | undefined,
): void {
  const api = wellHub.wells().get(desktop)
  const context = contextOn(desktop, from)
  // 井还没挂上（开机那一小段）：没有地方开，也就什么都不做
  if (api === undefined || context === undefined) return
  applyPlan(api, planOpen(spec, options, context, who))
}

/** 新开一份交给 dockview 的那几样（位置另给） */
interface NewPanel {
  id: string
  component: string
  tabComponent: string
  title: string
  params: Record<string, unknown>
}

/** 把 `planOpen` 的判断落成动作。副作用全在这儿，判断一条都不在 */
function applyPlan(api: DockviewApi, plan: OpenPlan): void {
  // 四种 kind 都可能带话：开出来了也可能顺带说了句「你传的保留键摘掉了」
  if (plan.notice !== undefined) console.warn(`[shell] ${plan.notice}`)
  if (plan.kind === 'none') return
  if (plan.kind === 'focus') {
    const panel = api.getPanel(plan.id)
    if (panel === undefined) return
    // 转正就是把 preview 这个键删掉（写 undefined 就是删），跟双击标签、keepPane 同一个动作
    if (plan.keep === true) panel.api.updateParameters({ preview: undefined })
    panel.api.setActive()
    return
  }
  if (plan.kind === 'retarget') {
    const panel = api.getPanel(plan.id)
    // 快照是刚从井里摘的，这一格不该凭空没了。真没了就当什么都没发生——补开一格的话，
    // 人看到的是「点一下冒出来两格」，比少开一格更难往回查
    if (panel === undefined) return
    // **`replaceParams` 少不了**：dockview 的 updateParameters 是并不是换，上一份内容
    // 的参数不显式写成 undefined 就会赖在这一格里，跟着 toJSON() 一起落盘
    panel.api.updateParameters(replaceParams(panel.params, plan.params))
    panel.api.setActive()
    return
  }
  const panel: NewPanel = {
    id: plan.id,
    component: plan.spec.component,
    tabComponent: TAB_COMPONENT,
    title: plan.title,
    params: panelParamsOf(plan.spec),
  }
  const { at } = plan
  if ('group' in at) {
    // **index 少不了**：dockview 的 openPanel 不给 index 就追加到组末尾
    api.addPanel({ ...panel, position: { referenceGroup: at.group, index: at.index } })
  } else if ('split' in at) {
    splitOpen(api, at.split, panel)
  } else {
    api.addPanel(panel)
  }
}

/**
 * 把基准组对半分、新窗格开在右半边，**别的组一动不动**。
 *
 * 不走 `addPanel` 带参照带方向那条：不给尺寸时 dockview 让同一排全部均分；给 `initialWidth`
 * 时它从这一排**最右那组**扣宽度，基准组不在最右就牵动别人（隔离 home 里量过）。能只切
 * 基准组一半的是拖放那条路（`dropSizing` → `Sizing.Split`），所以先把新窗格当不激活的
 * 标签开进基准组、再 `moveTo` 到它右边。基准组在一列里时 dockview 要把它包进新分支、会吞掉
 * 一份组间缝的摊额（`splitHeightFix`），这儿量出来补回去。
 */
function splitOpen(api: DockviewApi, baseId: string, panel: NewPanel): void {
  const base = api.groups.find((g) => g.id === baseId)
  if (base === undefined) {
    api.addPanel(panel)
    return
  }
  const before = base.api.height
  const added = api.addPanel({ ...panel, position: { referenceGroup: base }, inactive: true })
  added.api.moveTo({ group: base, position: 'right' })
  const fix = splitHeightFix(before, base.api.height)
  if (fix !== undefined) base.api.setSize({ height: fix })
}
