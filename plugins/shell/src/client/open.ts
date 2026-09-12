import type { DockviewApi } from 'dockview-react'
import {
  panelParamsOf,
  planOpen,
  specForOwnPane,
  titleForOrdinal,
  uniquePanelId,
  type OpenableSpec,
  type OpenPaneOptions,
  type OpenPlan,
} from '../openable.js'
import { replaceParams } from '../panels.js'
import { fetchPanes } from './panes.js'
import { wellHub } from './well-hub.js'
import type { HostBridge } from './types.js'

/**
 * 开格的**执行层**：判断全在纯函数 `planOpen`（`openable.ts`），这儿只按判断分派成
 * dockview 的动作——聚焦、软换、新开、落位。喂 `planOpen` 的表是全井聚合的
 * （`wellHub.openInstances`），井本身、活动桌面、切桌分派都从枢纽过。
 */

/** 这一条 spec 背后是谁的哪一格 */
function whoOf(spec: OpenableSpec): { entryId: string; paneId: string } {
  return { entryId: spec.params.entryId, paneId: spec.params.paneId }
}

/**
 * 状态栏那张表上点这一条会不会走成**聚焦**——那个「已开」记号标的就是它。
 *
 * **记号必须跟点下去的效果对齐**：那条入口不给 `key`（等于空串），所以它开/聚焦的是
 * 「没装特定内容的那一份」——而**那一份可以在别的桌面**（全局表）：此时点下去走成
 * 切过去聚焦，记号照样标，任务栏语义。
 *
 * **问的就是 `planOpen` 自己**：在这儿另写一条「key 为空的那份在不在」就是第二份真相，
 * 两处迟早漂，而漂了没有任何现象——只是那个记号开始说谎。
 */
export function willFocus(spec: OpenableSpec): boolean {
  const who = whoOf(spec)
  return planOpen(spec, undefined, wellHub.openInstances(who), who).kind === 'focus'
}

/** dockview 的标签组件表按键取用，开格时 `tabComponent` 指到这个键 */
export const TAB_COMPONENT = 'gwb-tab'

/**
 * 面板 params：件的识别三件套 + 标签要的图标名 + 件开这一份时传的那些键（已由
 * `planOpen` 并进 `spec.params`）。图标走 params 是借道——dockview 没给图标留位子，
 * 而 GwbTab 只拿得到面板 params 与 api。
 *
 * **这一份跟着布局落盘**：dockview 的 `toJSON` 原样带上 params，整档写进 gwbData 的
 * `layout`，`fromJSON` 再原样喂回来。件传的参数免费活过重启，代价是它必须可 JSON
 * 序列化——所以往这儿塞活对象是不行的。
 */
function panelParams(spec: OpenableSpec): Record<string, unknown> {
  // 拼法归 `panelParamsOf`（开格与软换同吃那一处）
  return panelParamsOf(spec)
}

/**
 * 开一格：算出这一份的实例 id 再 `addPanel`。**查重看全井**（`takenAnywhere`）——桌面
 * 是分组不是宇宙，实例 id 全页唯一，第二份在任何一口井都叫 `:2`。
 *
 * **`addPanel` 撞已存在的 id 是同步抛 Error**（dockview 的 `_doAddPanel` 头一句就是
 * 这个守卫），所以 id 必须先算好——不能指望它回一个「已经有了」。
 */
export function addInstance(api: DockviewApi, spec: OpenableSpec): void {
  const { id, ordinal } = uniquePanelId(spec.id, (candidate) => wellHub.takenAnywhere(candidate))
  api.addPanel({
    id,
    component: spec.component,
    tabComponent: TAB_COMPONENT,
    title: titleForOrdinal(spec.title, ordinal),
    params: panelParams(spec),
  })
}

/**
 * 件说「打开我的某一格」。判断全在 `planOpen` 那个纯函数里，喂它的是**全井聚合**的表；
 * 这儿只按 kind 分派（聚焦可能落在别的井——`applyPlan` 会把那口井切到台前）。
 *
 * `entryId` 由面板组件那边闭包绑好，件报不出别人的条目，也就打不开别人的窗格。
 *
 * **表现取不用快照**：件是热挂载的，后挂上的件手上那份快照里没有它自己。取表是一次
 * 本地 IPC，而调用方全是 click 回调、没人等返回值。
 *
 * `await` 之后**算 id 与 addPanel 必须在同一个同步段里**：中间再插一次 await 的话，
 * 两次并发的 openPane 会算出同一个 id，第二个 addPanel 当场抛。
 */
export async function openOwnPane(
  host: HostBridge,
  who: { entryId: string; paneId: string },
  options: OpenPaneOptions | undefined,
): Promise<void> {
  const panes = await fetchPanes(host)
  applyPlan(planOpen(specForOwnPane(panes, who.entryId, who.paneId), options, wellHub.openInstances(who), who))
}

/**
 * 外壳自己开一格（状态栏那张「可开的窗格」列表点的就是这条）。**走跟件调 `openPane`
 * 同一个 `planOpen`、同一张全局表**——所以行为一致：打开这一格，已经开着（**任何桌面**）
 * 就切过去聚焦，任务栏语义。
 */
export function openSpec(spec: OpenableSpec): void {
  const who = whoOf(spec)
  applyPlan(planOpen(spec, undefined, wellHub.openInstances(who), who))
}

/** 把 `planOpen` 的判断落成动作。副作用全在这儿，判断一条都不在 */
function applyPlan(plan: OpenPlan): void {
  // 四种 kind 都可能带话：开出来了也可能顺带说了句「你传的保留键摘掉了」
  if (plan.notice !== undefined) console.warn(`[shell] ${plan.notice}`)
  if (plan.kind === 'none') return
  if (plan.kind === 'focus') {
    focusAcross(plan.id)
    return
  }
  // 预览槽与落位都只在本井找（planOpen 已保证 id 在活动井），新份也开在活动井
  const api = wellHub.wells().get(wellHub.activeDesktop())
  if (api === undefined) return
  if (plan.kind === 'retarget') {
    const panel = api.getPanel(plan.id)
    // 表是刚从井里摘的，这一格不该凭空没了。真没了就当什么都没发生——补开一格的话，
    // 人看到的是「点一下冒出来两格」，比少开一格更难往回查
    if (panel === undefined) return
    // **`replaceParams` 少不了**：dockview 的 updateParameters 是并不是换，上一份内容
    // 的参数不显式写成 undefined 就会赖在这一格里，跟着 toJSON() 一起落盘
    panel.api.updateParameters(replaceParams(panel.params, plan.params))
    panel.api.setActive()
    return
  }
  // 摆哪儿是 `planOpen` 算好的两格（`direction` / `referencePanel`），这儿只换成
  // dockview 的形状。**`referencePanel` 有就得带上**：只给 direction 的 position 在
  // dockview 那头是 AbsolutePosition，落的是整口井的边，不是「参照那一份的下面」
  const position =
    plan.direction === undefined
      ? undefined
      : plan.referencePanel === undefined
        ? { direction: plan.direction }
        : { direction: plan.direction, referencePanel: plan.referencePanel }
  api.addPanel({
    id: plan.id,
    component: plan.spec.component,
    tabComponent: TAB_COMPONENT,
    title: plan.title,
    params: panelParams(plan.spec),
    // 不给 position 的那一档是真的一个键都不给：它落进当前 group 当兄弟 tab
    ...(position === undefined ? {} : { position }),
  })
}

/**
 * **全局聚焦**：这一份在哪口井，就把那口井切到台前再激活——任务栏点一个在别的虚拟
 * 桌面上的窗口，Windows 干的就是这件事。井各管各的 panel 表，id 的属主唯一。井常驻
 * （保活），激活不必等显隐真落地（api 活着，CSS 只是衣裳）。
 */
function focusAcross(panelId: string): void {
  for (const [desktop, api] of wellHub.wells()) {
    const panel = api.getPanel(panelId)
    if (panel === undefined) continue
    if (desktop !== wellHub.activeDesktop()) wellHub.switcher()?.(desktop)
    panel.api.setActive()
    return
  }
}
