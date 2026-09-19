import { useRef, type ReactElement, type ReactNode } from 'react'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { pluginParamsIn } from '../panels.js'
import { tabsToClose } from '../pane-list.js'
import { openRegisteredPane } from './open.js'
import { portalHostOf } from './desktop-context.js'
import { wellHub } from './well-hub.js'

/**
 * 标签右键菜单：留住、在旁边再开一份、关闭 / 关闭其他 / 关闭右侧。挂在本桌面的浮层户口上
 * （桌面切走跟着藏），跟状态栏菜单同一套组件。
 *
 * 「在旁边再开一份」只给**文档窗格**：用这一份此刻的 key 与参数、`placement: 'side'` 开一份
 * 正式标签，来源就是这一份；原来那份是预览就先转正。工具窗格一张桌面至多一份，没有这一项。
 * 这一格是哪一类问注册表缓存（`wellHub.paneKind`），面板 params 里不存它。
 */
export function TabMenu({ tab, children }: { tab: IDockviewPanelHeaderProps; children: ReactNode }): ReactElement {
  const anchor = useRef<HTMLSpanElement>(null)
  const params = (tab.params ?? {}) as Record<string, unknown>
  const entryId = typeof params.entryId === 'string' ? params.entryId : undefined
  const paneId = typeof params.paneId === 'string' ? params.paneId : undefined
  const preview = params.preview === true
  const kind = entryId === undefined || paneId === undefined ? 'tool' : wellHub.paneKind(entryId, paneId)
  const self = tab.api.id

  const order = (): string[] => tab.api.group.panels.map((p) => p.id)
  const keep = (): void => tab.api.updateParameters({ preview: undefined })

  const openBeside = (): void => {
    const host = wellHub.host()
    if (host === undefined || entryId === undefined || paneId === undefined) return
    if (preview) keep()
    const key = typeof params.key === 'string' ? params.key : ''
    const mine = pluginParamsIn(params)
    void openRegisteredPane(
      host,
      { entryId, paneId },
      { key, ...(mine === undefined ? {} : { params: mine }), placement: 'side' },
      self,
    ).catch((err: unknown) => console.error(`[shell] 在旁边再开一份失败：${String(err)}`))
  }

  const closeMany = (which: 'others' | 'right'): void => {
    for (const id of tabsToClose(order(), self, which)) tab.containerApi.getPanel(id)?.api.close()
  }

  const ids = order()
  const at = ids.indexOf(self)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* 触发区就是整枚标签；锚点只用来找本桌面的浮层户口 */}
        <span ref={anchor} className="shell:contents">
          {children}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent container={portalHostOf(anchor.current)} data-gwb-tab-menu={self}>
        {preview && <ContextMenuItem onSelect={keep}>留住</ContextMenuItem>}
        {kind === 'document' && <ContextMenuItem onSelect={openBeside}>在旁边再开一份</ContextMenuItem>}
        {(preview || kind === 'document') && <ContextMenuSeparator />}
        <ContextMenuItem onSelect={() => tab.api.close()}>关闭</ContextMenuItem>
        <ContextMenuItem disabled={ids.length < 2} onSelect={() => closeMany('others')}>
          关闭其他
        </ContextMenuItem>
        <ContextMenuItem disabled={at < 0 || at === ids.length - 1} onSelect={() => closeMany('right')}>
          关闭右侧
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
