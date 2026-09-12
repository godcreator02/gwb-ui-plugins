import type { ReactElement } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { PluginPane } from './PluginPane.js'
import { wellHub } from './well-hub.js'
import { openOwnPane } from './open.js'
import { pluginParamsIn } from '../panels.js'
import type { ShellBridge } from './types.js'

/**
 * dockview 里的插件窗格面板：把面板 params 拆成两半（外壳的识别三件套、件自己那半），
 * 交给 `PluginPane` 按 `mountPane` 契约挂件。开格的判断与执行在 `open.ts`，命令口与
 * 井从枢纽过——这个组件只做「一份 params → 一个 PluginPane」。
 */
export function PluginPanel(props: IDockviewPanelProps): ReactElement {
  // 一份 params 装两半：外壳的识别三件套（加图标）在这儿读，件自己那半交给 pluginParamsIn 摘
  const params = props.params as Record<string, unknown> | undefined
  const pluginKey = params?.pluginKey
  const entryId = params?.entryId
  const paneId = params?.paneId
  if (
    typeof pluginKey !== 'string' ||
    typeof entryId !== 'string' ||
    typeof paneId !== 'string' ||
    wellHub.host() === undefined
  ) {
    // 这一格的 params 是外壳自己按 openable 拼的，缺项属于外壳的 bug。摆出来而不是
    // 画个空白——空白跟「件加载慢」分不开
    return <p className="shell:text-destructive shell:m-0 shell:p-3 shell:text-sm">这一格缺 params（外壳的 bug）</p>
  }
  const bridge = wellHub.host()!
  const openPane: ShellBridge['openPane'] = (target, options) => {
    // 件不等返回值（它是 click 回调），但这条链上的错得有出口。井不传——判断在模块层
    // 看全井（聚焦可能落到别的桌面），面板组件连 containerApi 都不用了
    void openOwnPane(bridge, { entryId, paneId: target }, options).catch((err: unknown) => {
      console.error(`[shell] 开 ${target} 失败：${String(err)}`)
    })
  }
  /**
   * 转正：把 `preview` 从**这一份**的 params 上删掉——写 `undefined` 就是删（dockview
   * 只删 undefined 的键），不写成 false。已经是正式格就什么都不做，免得白白带起一轮
   * params 变更与布局落盘。
   */
  const keepPane: ShellBridge['keepPane'] = () => {
    if (params?.preview !== true) return
    props.api.updateParameters({ preview: undefined })
  }
  return (
    <PluginPane
      pluginKey={pluginKey}
      entryId={entryId}
      paneId={paneId}
      panelId={props.api.id}
      // 件那半只看得见自己传的那些键：保留键摘掉，件不该认识 entryId 这种外壳内部的东西
      paneParams={pluginParamsIn(params)}
      host={bridge}
      openPane={openPane}
      setTitle={(title) => props.api.setTitle(title)}
      keepPane={keepPane}
    />
  )
}
