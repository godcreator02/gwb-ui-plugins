import { useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { pluginParamsIn } from '../panels.js'
import { tabsToClose } from '../pane-list.js'
import { openRegisteredPane, sendPane, type SendTarget } from './open.js'
import { desktopIdOf, portalHostOf } from './desktop-context.js'
import { wellHub } from './well-hub.js'

/** 标签右键菜单，挂在本桌面的浮层挂载点上；「在旁边再开一份」只给文档窗格，类别问 `wellHub.paneKind` */
export function TabMenu({ tab, children }: { tab: IDockviewPanelHeaderProps; children: ReactNode }): ReactElement {
  const anchor = useRef<HTMLSpanElement>(null)
  /** 打开那一刻才找挂载点：标签第一次渲染时锚点还不在 DOM 里，那时算会退回 body */
  const [host, setHost] = useState<HTMLElement | null>(null)
  const params = (tab.params ?? {}) as Record<string, unknown>
  // 缺 entryId / paneId（布局文件里这一份坏了）时窗格正文已显示出错（PluginPanel）；在渲染里抛错会让整个外壳白屏，
  // 所以这里只是不给「在旁边再开一份」
  const identity =
    typeof params.entryId === 'string' && typeof params.paneId === 'string' ? { entryId: params.entryId, paneId: params.paneId } : undefined
  const besideTarget = identity !== undefined && wellHub.paneKind(identity.entryId, identity.paneId) === 'document' ? identity : undefined
  const preview = params.preview === true
  const self = tab.api.id

  const order = (): string[] => tab.api.group.panels.map((p) => p.id)
  const keep = (): void => tab.api.updateParameters({ preview: undefined })

  const openBeside = ({ entryId, paneId }: { entryId: string; paneId: string }): void => {
    const host = wellHub.host()
    if (host === undefined) throw new Error('[shell] 在旁边再开一份：命令入口不在')
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

  /** 送到别的桌面或新桌面；选的时候按住 Shift 就送完跟过去 */
  const here = desktopIdOf(anchor.current)
  const targets = (wellHub.deskOps()?.rows() ?? []).filter((row) => row.id !== here)
  const shift = useRef(false)
  const noteShift = (e: { shiftKey: boolean }): void => {
    shift.current = e.shiftKey
  }
  const send = (to: SendTarget): void => {
    void sendPane(self, to, shift.current).catch((err: unknown) => console.error(`[shell] 送到别的桌面失败：${String(err)}`))
  }

  const ids = order()
  const at = ids.indexOf(self)

  return (
    <ContextMenu onOpenChange={(open) => open && setHost(portalHostOf(anchor.current))}>
      <ContextMenuTrigger asChild>
        {/* 触发区是整个标签；锚点只用来找本桌面的浮层挂载点 */}
        <span ref={anchor} className="shell:contents">
          {children}
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent container={host} data-gwb-tab-menu={self}>
        {preview && <ContextMenuItem data-gwb-tab-action="keep" onSelect={keep}>保持打开</ContextMenuItem>}
        {besideTarget !== undefined && (
          <ContextMenuItem data-gwb-tab-action="beside" onSelect={() => openBeside(besideTarget)}>
            在旁边再开一份
          </ContextMenuItem>
        )}
        {(preview || besideTarget !== undefined) && <ContextMenuSeparator />}
        <ContextMenuSub>
          <ContextMenuSubTrigger data-gwb-tab-action="send">送到</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {targets.map((row) => (
              <ContextMenuItem
                key={row.id}
                data-gwb-send-to={row.id}
                onPointerDown={noteShift}
                onKeyDown={noteShift}
                onSelect={() => send({ desktop: row.id })}
              >
                {row.name}
              </ContextMenuItem>
            ))}
            {targets.length > 0 && <ContextMenuSeparator />}
            <ContextMenuItem data-gwb-send-to="" onPointerDown={noteShift} onKeyDown={noteShift} onSelect={() => send({ newDesktop: '' })}>
              新桌面
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem data-gwb-tab-action="close" onSelect={() => tab.api.close()}>关闭</ContextMenuItem>
        <ContextMenuItem data-gwb-tab-action="close-others" disabled={ids.length < 2} onSelect={() => closeMany('others')}>
          关闭其他
        </ContextMenuItem>
        <ContextMenuItem data-gwb-tab-action="close-right" disabled={at < 0 || at === ids.length - 1} onSelect={() => closeMany('right')}>
          关闭右侧
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
