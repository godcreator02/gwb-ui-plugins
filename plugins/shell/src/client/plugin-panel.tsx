import type { ReactElement } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { PluginPane } from './PluginPane.js'
import { wellHub } from './well-hub.js'
import { openRegisteredPane } from './open.js'
import { pluginParamsIn } from '../panels.js'
import type { ShellBridge } from './types.js'

/** 把面板 params 分成外壳的身份字段与插件自己的那部分，交给 `PluginPane` */
export function PluginPanel(props: IDockviewPanelProps): ReactElement {
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
    // params 是外壳自己拼的，缺项是外壳的 bug；显示出来而不是留白，留白跟加载慢分不开
    return <p className="shell:text-destructive shell:m-0 shell:p-3 shell:text-sm">这个窗格缺 params（外壳的 bug）</p>
  }
  const bridge = wellHub.host()!
  const openPane: ShellBridge['openPane'] = (target, options) => {
    // 插件不等返回值，错误在这里记下；来源固定是这一份自己
    void openRegisteredPane(bridge, { entryId, paneId: target }, options, props.api.id).catch((err: unknown) => {
      console.error(`[shell] 开 ${target} 失败：${String(err)}`)
    })
  }
  /** 转正：写 `undefined` 删掉 preview；已是正式窗格就什么都不做，免得白白触发一轮参数变更与保存 */
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
      paneParams={pluginParamsIn(params)}
      host={bridge}
      openPane={openPane}
      setTitle={(title) => props.api.setTitle(title)}
      keepPane={keepPane}
      updateParams={(update) => props.api.updateParameters(update)}
    />
  )
}
