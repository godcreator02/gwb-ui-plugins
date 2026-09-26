import type { ReactElement } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { PluginPane } from './PluginPane.js'
import { wellHub } from './well-hub.js'
import { openRegisteredPane } from './open.js'
import { pluginParamsIn } from '../panels.js'
import type { ShellBridge } from './types.js'

/** 把面板 params 分成外壳的身份字段与插件自己的那部分，交给 `PluginPane` */
export function PluginPanel(props: IDockviewPanelProps): ReactElement {
  const bridge = wellHub.host()
  // 挂载那段先 setHost 再渲染，卸载完才 releaseHost
  if (bridge === undefined) throw new Error(`[shell] 渲染窗格 ${props.api.id} 时命令入口不在`)
  const params = props.params as Record<string, unknown> | undefined
  const pluginKey = params?.pluginKey
  const entryId = params?.entryId
  const paneId = params?.paneId
  if (typeof pluginKey !== 'string' || typeof entryId !== 'string' || typeof paneId !== 'string') {
    // params 由外壳拼好、随布局文件恢复；缺项时显示出来而不是留白，留白跟加载慢分不开
    const missing = (['pluginKey', 'entryId', 'paneId'] as const).filter((name) => typeof params?.[name] !== 'string')
    return (
      <p className="shell:text-destructive shell:m-0 shell:p-3 shell:text-sm">
        窗格 {props.api.id} 的 params 缺 {missing.join('、')}（外壳拼的或布局文件里的这一份坏了），开不了
      </p>
    )
  }
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
