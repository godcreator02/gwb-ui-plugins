import { useEffect, useState, type ReactElement } from 'react'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { X } from 'lucide-react'
import { cn } from 'cn'
import { iconFor } from './icon.js'
import { TabMenu } from './TabMenu.js'

export function GwbTab(props: IDockviewPanelHeaderProps): ReactElement {
  const params = (props.params ?? {}) as { icon?: string; preview?: unknown }
  const Icon = iconFor(params.icon)
  // params 换了 dockview 会重渲染标签，直接读 props 就够
  const preview = params.preview === true
  const panelId = props.api.id
  const [group, setGroup] = useState(props.api.group)
  const [active, setActive] = useState(() => props.api.group.activePanel?.id === panelId)

  // 面板会被拖到别的组，所以先跟住自己在哪一组，再跟住那一组的活动面板
  useEffect(() => {
    const d = props.api.onDidGroupChange(() => setGroup(props.api.group))
    return () => d.dispose()
  }, [props.api])

  useEffect(() => {
    const sync = (): void => setActive(group.activePanel?.id === panelId)
    sync()
    const d = group.api.onDidActivePanelChange(sync)
    return () => d.dispose()
  }, [group, panelId])

  // 插件运行时改标题（setPaneTitle）时自定义标签不会重渲染，要订这个事件
  const [title, setTitle] = useState(props.api.title ?? '')
  useEffect(() => {
    setTitle(props.api.title ?? '')
    const d = props.api.onDidTitleChange(() => setTitle(props.api.title ?? ''))
    return () => d.dispose()
  }, [props.api])

  return (
    <TabMenu tab={props}>
    {/* h-full：槽位高 26px（标签条 32 减上下各 3px，见 dockview-theme.css） */}
    <div
      className={cn(
        'shell:group/tab shell:flex shell:h-full shell:w-full shell:min-w-0 shell:cursor-grab shell:items-center shell:gap-1.5 shell:rounded-md shell:px-2 shell:text-[13px] shell:transition-colors shell:select-none',
        active
          ? 'shell:bg-muted shell:text-foreground'
          : 'shell:text-muted-foreground shell:hover:bg-accent/50 shell:hover:text-foreground',
      )}
      title={preview ? `${title}（预览格：下一次打开会顶掉它。双击这枚标签留住它）` : title}
      // 双击转正：dockview 不用 dblclick，拖拽走 pointer 事件，互不冲突；已是正式窗格时是空操作
      onDoubleClick={() => props.api.updateParameters({ preview: undefined })}
    >
      <Icon className="shell:size-4 shell:shrink-0" />
      {preview && (
        // 空心圆点而不是淡一档：未激活的标签本来就是淡色；边框用 currentColor 跟着标签变色
        <span
          role="img"
          aria-label="预览格：这一格会被下一次打开顶掉"
          className="shell:size-2 shell:shrink-0 shell:rounded-full shell:border shell:border-current"
        />
      )}
      <span className="shell:min-w-0 shell:truncate">{title}</span>
      <button
        type="button"
        aria-label="关闭"
        // 只在悬停时显示；切 opacity 不切 display，否则标签宽度会随鼠标进出跳动
        className={cn(
          'shell:hover:bg-accent shell:flex shell:size-5 shell:shrink-0 shell:cursor-pointer shell:items-center shell:justify-center shell:rounded-md shell:transition-opacity',
          'shell:opacity-0 shell:group-hover/tab:opacity-70 shell:hover:opacity-100',
        )}
        onClick={(e) => {
          // 不冒泡成激活这个窗格
          e.stopPropagation()
          props.api.close()
        }}
      >
        <X className="shell:size-3" />
      </button>
    </div>
    </TabMenu>
  )
}
