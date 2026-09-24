import type { DockviewApi } from 'dockview-react'
import {
  panelParamsOf,
  planLaunch,
  planOpen,
  planSend,
  specForOwnPane,
  splitHeightFix,
  titleForOrdinal,
  uniquePanelId,
  type OpenableSpec,
  type OpenContext,
  type OpenPaneOptions,
  type OpenPlan,
} from '../openable.js'
import { pluginParamsIn, replaceParams } from '../panels.js'
import { fetchPanes } from './panes.js'
import { wellHub } from './well-hub.js'
import type { HostBridge } from './types.js'

/** 认不出就用 id */
function desktopNameOf(desktop: string): string {
  return wellHub.deskOps()?.rows().find((row) => row.id === desktop)?.name ?? desktop
}

/** 容器还没挂载回 undefined */
function openContextOnDesktop(desktop: string, from: string | undefined): OpenContext | undefined {
  const desk = wellHub.deskOf(desktop)
  if (desk === undefined) return undefined
  return {
    desk,
    taken: (id) => wellHub.takenAnywhere(id),
    // 别的桌面（已挂载的与没挂载过的都算）上开着的同一窗格、同一 key
    elsewhere: (def, key) => {
      const sameContentElsewhere = wellHub
        .entries()
        .find((entry) => entry.desktop !== desktop && entry.entryId === def.entryId && entry.paneId === def.paneId && entry.key === key)
      return sameContentElsewhere === undefined
        ? undefined
        : { desktop: sameContentElsewhere.desktop, id: sameContentElsewhere.instance, preview: sameContentElsewhere.preview }
    },
    ...(from === undefined ? {} : { from }),
  }
}

/** 启动器行尾写什么：「本桌」、别的桌面的名字，或 undefined（开一份新的）。问的就是 `planLaunch`，不另写判断 */
export function launchGoesTo(spec: OpenableSpec): string | undefined {
  const context = openContextOnDesktop(wellHub.activeDesktop(), undefined)
  if (context === undefined) return undefined
  const plan = planLaunch(spec, context)
  if (plan.kind === 'focus') return '本桌'
  if (plan.kind === 'reveal') return desktopNameOf(plan.desktop)
  return undefined
}

/** 人在启动器里点的：工具窗格开在别的桌面上就切过去 */
export function launchSpec(spec: OpenableSpec): Promise<void> {
  const desktop = wellHub.activeDesktop()
  const api = wellHub.wells().get(desktop)
  const context = openContextOnDesktop(desktop, undefined)
  if (api === undefined || context === undefined) return Promise.resolve()
  return applyPlan(api, planLaunch(spec, context), 'switch')
}

/** 显式激活：在别的桌面就切过去，没挂载过的先挂载 */
export async function focusInstance(desktop: string, instance: string): Promise<void> {
  const deskOps = wellHub.deskOps()
  if (deskOps === undefined) return
  if (desktop !== wellHub.activeDesktop()) deskOps.switchTo(desktop)
  const api = await deskOps.ensureMounted(desktop)
  api?.getPanel(instance)?.api.setActive()
}

/** 不切桌面：没挂载过的桌面在后台挂载后再关 */
export async function closeInstance(desktop: string, instance: string): Promise<void> {
  const api = await wellHub.deskOps()?.ensureMounted(desktop)
  api?.getPanel(instance)?.api.close()
}

/** 已有桌面的 id，或新建一张（名字空串用缺省名） */
export type SendTarget = { desktop: string } | { newDesktop: string }

/** 送过去的是这一份的 key 与插件自己的那部分参数 */
function carriedContentOf(panelParams: Record<string, unknown> | undefined): { key: string; params?: Record<string, unknown> } {
  const pluginParams = pluginParamsIn(panelParams)
  return { key: typeof panelParams?.key === 'string' ? panelParams.key : '', ...(pluginParams === undefined ? {} : { params: pluginParams }) }
}

/**
 * dockview 没有跨实例搬面板的接口，所以送到别的桌面是一次关闭加一次打开；当前桌面不变，`follow` 才跟过去。
 * 定义已不在注册表里（插件卸载了）就不送：关得掉、开不回来的话这一份就没了
 */
export async function sendPane(instance: string, to: SendTarget, follow: boolean): Promise<void> {
  const deskOps = wellHub.deskOps()
  const host = wellHub.host()
  if (deskOps === undefined || host === undefined) return
  const sourceEntry = wellHub.entries().find((entry) => entry.instance === instance)
  if (sourceEntry === undefined) {
    console.warn(`[shell] 送到别的桌面：窗格 ${instance} 哪张桌面都没有`)
    return
  }
  const targetDesktop = 'desktop' in to ? to.desktop : deskOps.createDesktop(to.newDesktop)
  const [sourceApi, targetApi] = [await deskOps.ensureMounted(sourceEntry.desktop), await deskOps.ensureMounted(targetDesktop)]
  const panes = await fetchPanes(host)
  // 从这里往下是同步的一段：读快照、算 id、addPanel 之间不能插 await
  const spec = specForOwnPane(panes, sourceEntry.entryId, sourceEntry.paneId)
  const panel = sourceApi?.getPanel(instance)
  if (spec === undefined || sourceApi === undefined || targetApi === undefined || panel === undefined) {
    console.warn(`[shell] 送到别的桌面：${instance} 的定义或两头的桌面认不出，这次不送`)
    return
  }
  if (targetDesktop === sourceEntry.desktop) {
    panel.api.setActive()
    return
  }
  const content = carriedContentOf(panel.params as Record<string, unknown> | undefined)
  const title = panel.title ?? spec.title
  panel.api.close()
  const context = openContextOnDesktop(targetDesktop, undefined)
  if (context === undefined) return
  void applyPlan(targetApi, planSend(spec, content, title, context), 'stay')
  if (follow) deskOps.switchTo(targetDesktop)
  else if (targetDesktop !== wellHub.activeDesktop()) deskOps.notify(targetDesktop, `已送到『${desktopNameOf(targetDesktop)}』`)
}

/** dockview 标签组件表里的键，开窗格时 `tabComponent` 指向它 */
export const TAB_COMPONENT = 'gwb-tab'

/**
 * 默认布局与重置布局用：全开进活动组。`addPanel` 遇到已存在的 id 同步抛错，所以先算好全页唯一的实例 id
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
 * 插件开自己的窗格与 `shell.openPane` 都走这里；注册表当场取，不用快照（插件可能运行中才加载）。
 * `from` 哪张桌面都找不到就当没有来源、开在当前桌面。
 * `await` 之后读快照、算 id、addPanel 必须在同一段同步代码里，否则两次并发打开会算出同一个 id
 */
export async function openRegisteredPane(
  host: HostBridge,
  who: { entryId: string; paneId: string },
  options: OpenPaneOptions | undefined,
  from?: string,
): Promise<void> {
  const panes = await fetchPanes(host)
  const sourceDesktop = from === undefined ? undefined : wellHub.locate(from)
  if (from !== undefined && sourceDesktop === undefined) {
    console.warn(`[shell] 开 ${who.entryId} 的 ${who.paneId}：来源窗格 ${from} 哪张桌面都没有，当没有来源、开在当前桌面`)
  }
  openOnDesktop(
    sourceDesktop ?? wellHub.activeDesktop(),
    specForOwnPane(panes, who.entryId, who.paneId),
    options,
    who,
    sourceDesktop === undefined ? undefined : from,
  )
}

/** 插件与命令开的：工具窗格在别的桌面上也不切过去，只提示 */
function openOnDesktop(
  desktop: string,
  spec: OpenableSpec | undefined,
  options: OpenPaneOptions | undefined,
  who: { entryId: string; paneId: string },
  from: string | undefined,
): void {
  const api = wellHub.wells().get(desktop)
  const context = openContextOnDesktop(desktop, from)
  if (api === undefined || context === undefined) return
  void applyPlan(api, planOpen(spec, options, context, who), 'stay')
}

/**
 * 工具窗格开在别的桌面上：到那张桌面激活它。`switch`（人在启动器里点的）切过去；
 * `stay`（插件与命令开的）不切，那张不是当前桌面就在状态栏提示
 */
async function revealOnOtherDesktop(plan: Extract<OpenPlan, { kind: 'reveal' }>, how: 'switch' | 'stay'): Promise<void> {
  const deskOps = wellHub.deskOps()
  if (deskOps === undefined) return
  if (how === 'switch') deskOps.switchTo(plan.desktop)
  const api = await deskOps.ensureMounted(plan.desktop)
  const panel = api?.getPanel(plan.id)
  if (panel === undefined) return
  if (plan.keep === true) panel.api.updateParameters({ preview: undefined })
  panel.api.setActive()
  if (how === 'stay' && plan.desktop !== wellHub.activeDesktop()) {
    deskOps.notify(plan.desktop, `『${panel.title ?? plan.id}』在『${desktopNameOf(plan.desktop)}』`)
  }
}

/** 新开一份交给 dockview 的那几样，位置另给 */
interface NewPanel {
  id: string
  component: string
  tabComponent: string
  title: string
  params: Record<string, unknown>
}

function focusPanel(api: DockviewApi, plan: Extract<OpenPlan, { kind: 'focus' }>): void {
  const panel = api.getPanel(plan.id)
  if (panel === undefined) return
  // 转正就是删掉 preview：写 undefined 即删除
  if (plan.keep === true) panel.api.updateParameters({ preview: undefined })
  panel.api.setActive()
}

function retargetPanel(api: DockviewApi, plan: Extract<OpenPlan, { kind: 'retarget' }>): void {
  const panel = api.getPanel(plan.id)
  // 快照刚读过，真没了就什么都不做：补开一份的话人看到的是点一下冒出两个
  if (panel === undefined) return
  // updateParameters 是合并：上一份内容多出的参数不写成 undefined 就会留下并随布局保存
  panel.api.updateParameters(replaceParams(panel.params, plan.params))
  panel.api.setActive()
}

function openNewPanel(api: DockviewApi, plan: Extract<OpenPlan, { kind: 'open' }>): void {
  const newPanel: NewPanel = {
    id: plan.id,
    component: plan.spec.component,
    tabComponent: TAB_COMPONENT,
    title: plan.title,
    params: panelParamsOf(plan.spec),
  }
  const { at } = plan
  if ('group' in at) {
    // 不给 index 的话 dockview 追加到组末尾
    api.addPanel({ ...newPanel, position: { referenceGroup: at.group, index: at.index } })
  } else if ('split' in at) {
    splitOpen(api, at.split, newPanel)
  } else {
    api.addPanel(newPanel)
  }
}

/** 判断在 openable.ts，这里只执行；只有 reveal 是异步的（可能要先在后台挂载容器） */
function applyPlan(api: DockviewApi, plan: OpenPlan, how: 'switch' | 'stay'): Promise<void> {
  if (plan.notice !== undefined) console.warn(`[shell] ${plan.notice}`)
  if (plan.kind === 'none') return Promise.resolve()
  if (plan.kind === 'reveal') return revealOnOtherDesktop(plan, how)
  if (plan.kind === 'focus') focusPanel(api, plan)
  else if (plan.kind === 'retarget') retargetPanel(api, plan)
  else openNewPanel(api, plan)
  return Promise.resolve()
}

/**
 * 把基准组对半分、新窗格开在右半边，别的组不动：先当不激活的标签开进基准组，再 `moveTo` 到它右边
 * （dockview 拖放那条路只切参照组一半），基准组被包进新分支时用 `splitHeightFix` 补回高度
 */
function splitOpen(api: DockviewApi, baseId: string, newPanel: NewPanel): void {
  const baseGroup = api.groups.find((group) => group.id === baseId)
  if (baseGroup === undefined) {
    api.addPanel(newPanel)
    return
  }
  const baseHeightBefore = baseGroup.api.height
  const addedPanel = api.addPanel({ ...newPanel, position: { referenceGroup: baseGroup }, inactive: true })
  addedPanel.api.moveTo({ group: baseGroup, position: 'right' })
  const fixedBaseHeight = splitHeightFix(baseHeightBefore, baseGroup.api.height)
  if (fixedBaseHeight !== undefined) baseGroup.api.setSize({ height: fixedBaseHeight })
}
