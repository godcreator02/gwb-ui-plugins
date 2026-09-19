import { useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react'
import { Monitor, Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { deleteConfirmText } from '../desktops.js'
import type { DesktopRow } from '../layout.js'
import { acceptsDrop, type DeskSection } from '../pane-list.js'
import { iconFor } from './icon.js'
import type { SendTarget } from './open.js'
import { draggedPane, endRowDrag, startRowDrag } from './pane-drag.js'

/**
 * 状态栏的「桌面」面板：**只摆桌面与各桌面上的窗格**（人定的，见 spec 已拍板第二轮）。原先是两格——
 * 「桌面」（清单、改名、删除、新建）与「窗格 N」（按桌面分组的窗格，行尾关闭 / 送到 / 拉到本桌）——
 * 列的是同一棵树，并成一格；行尾的动作全拿掉，送到与拉到本桌改成拖拽：
 *
 * - 点桌面切过去，点窗格激活它（在别的桌面就切过去）；右键桌面名改名；删除钮一律先确认
 * - 把窗格拖到另一张桌面上 = 送过去，拖到当前桌面上 = 拉到本桌，拖到「新建桌面」上 = 送到新桌面；
 *   放下时按住 Shift 就跟过去
 * - 从桌面上拖一枚标签到状态栏这一格上停一下，面板自己弹开（弹簧载入），再放到哪张桌面上
 *
 * 是弹出面板不是菜单：菜单的规矩是点一项就选中关掉、按键拿去做首字母跳转，跟改名框、拖拽都对着干。
 * 关窗格不在这儿（标签上的 ✕、标签右键菜单）。
 */

/** 拖着标签在状态栏这一格上停多久，面板自己弹开 */
const SPRING_MS = 500

const ROW = 'shell:flex shell:h-7 shell:items-center shell:gap-1.5 shell:rounded shell:px-2 shell:text-xs shell:select-none'

export function DesktopPanel({
  triggerClassName,
  desktops,
  activeId,
  onSections,
  panesTick,
  onSwitch,
  onFocusPane,
  onSend,
  onNew,
  onRename,
  onDelete,
}: {
  /** 状态栏格子的外观（跟别的格同一套） */
  triggerClassName: string
  desktops: readonly DesktopRow[]
  activeId: string
  /** 此刻的那棵树：所有桌面与各自开着的窗格，照桌面顺序。每次点开、每次拖放完现取 */
  onSections: () => DeskSection[]
  /** 窗格清单变了几回（外壳每次落盘加一）：开着的时候别处开关了窗格，按它重摘 */
  panesTick: number
  onSwitch: (id: string) => void
  onFocusPane: (desktop: string, instance: string) => void
  /** 送到别的桌面（拖放）；follow = 放下时按住了 Shift */
  onSend: (instance: string, to: SendTarget, follow: boolean) => Promise<void>
  /** 新建桌面并切过去。空名由外壳拿缺省名顶上 */
  onNew: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}): ReactElement {
  const [open, setOpen] = useState(false)
  const [sections, setSections] = useState<DeskSection[]>([])
  /** 正在改名的那一张：桌面名那一行变输入框，Enter 定、Esc 或失焦弃，空名不改 */
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  /** 正在起名的新桌面：「新建桌面…」那一行变输入框 */
  const [naming, setNaming] = useState<string | null>(null)
  /** 等人确认删除的那一张 */
  const [confirming, setConfirming] = useState<{ id: string; name: string; panes: number } | null>(null)
  /** 拖着的窗格此刻悬在哪个落点上（桌面 id；'' 是「新建桌面」） */
  const [over, setOver] = useState<string | null>(null)
  const spring = useRef<number | undefined>(undefined)
  const active = desktops.find((d) => d.id === activeId)

  /** 拖放送完重摘：送到是异步的（可能要先在后台挂井），桌面清单不一定变，得自己摘 */
  const refresh = (): void => setSections(onSections())
  // 点开那一刻、开着时桌面清单变了（改名、删除、切过去）、窗格变了（别处开关了窗格，外壳落盘时
  // panesTick 加一）都重摘。依赖里**故意没有 onSections**：它每轮都是新函数，按它重跑等于每轮都
  // 重摘；清单的变化由这四样带进来
  useEffect(() => {
    if (open) setSections(onSections())
  }, [open, desktops, activeId, panesTick])

  const cancelSpring = (): void => {
    window.clearTimeout(spring.current)
    spring.current = undefined
  }
  useEffect(() => cancelSpring, [])

  const changeOpen = (next: boolean): void => {
    cancelSpring()
    setOpen(next)
    if (!next) {
      setRenaming(null)
      setNaming(null)
      setOver(null)
    }
  }

  /**
   * 拖着标签停在格子上：停够 SPRING_MS 面板自己弹开。拖的不是窗格不理。到点再问一次还拖着没有——
   * 在格子上就松手（或按 Esc 取消）的话，拖拽已经结束，不该凭空弹出面板
   */
  const springOver = (): void => {
    if (open || spring.current !== undefined || draggedPane() === undefined) return
    spring.current = window.setTimeout(() => {
      spring.current = undefined
      if (draggedPane() !== undefined) setOpen(true)
    }, SPRING_MS)
  }
  const springLeave = (e: DragEvent): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) cancelSpring()
  }

  /** 一个落点：桌面（`desk` 是它的 id）或「新建桌面」（`desk` 为 ''） */
  const dropZone = (desk: string, to: SendTarget) => ({
    onDragOver: (e: DragEvent) => {
      const pane = draggedPane()
      const ok = desk === '' ? pane?.desktop !== undefined : acceptsDrop(pane?.desktop, desk)
      if (!ok) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOver(desk)
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((cur) => (cur === desk ? null : cur))
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setOver(null)
      const pane = draggedPane()
      endRowDrag()
      if (pane === undefined) return
      // 按住 Shift 放下是「送完跟过去」——跟点桌面、点别桌的窗格一样，切桌面的动作都把面板收起来
      if (e.shiftKey) changeOpen(false)
      void onSend(pane.instance, to, e.shiftKey).then(refresh, (err: unknown) => {
        console.error(`[shell] 拖到别的桌面失败：${String(err)}`)
      })
    },
  })

  const askDelete = (section: DeskSection): void => {
    changeOpen(false)
    setConfirming({ id: section.desktop, name: section.name, panes: section.rows.length })
  }
  const confirmText = confirming === null ? undefined : deleteConfirmText(confirming.name, confirming.panes)

  const renameInput = (id: string, value: string): ReactElement => (
    <input
      className="shell:bg-background shell:h-6 shell:min-w-0 shell:flex-1 shell:rounded shell:px-1.5 shell:text-xs shell:text-foreground shell:outline-none"
      value={value}
      autoFocus
      data-gwb-desk-rename={id}
      placeholder="桌面名（Enter 定，Esc 弃）"
      // 输入框在桌面那一行里：点它不能冒泡成「切过去」
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setRenaming({ id, value: e.target.value })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onRename(id, value)
          setRenaming(null)
        }
        if (e.key === 'Escape') setRenaming(null)
      }}
      onBlur={() => setRenaming(null)}
    />
  )

  const commitNew = (): void => {
    if (naming === null) return
    onNew(naming.trim())
    setNaming(null)
    changeOpen(false)
  }

  return (
    <>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger
          className={triggerClassName}
          data-gwb-desktop-panel=""
          title="桌面：所有桌面与上面的窗格。拖着标签停在这儿，面板自己弹开"
          onDragOver={springOver}
          onDragLeave={springLeave}
        >
          <Monitor className="shell:size-3.5" />
          {active?.name ?? '桌面'}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="shell:w-64 shell:p-1"
          data-gwb-desktops=""
          // 状态栏自己的浮层：挂 body 是本分，切桌面后的 body 探雷认得它（见 index.tsx 的 sweepBodyPortals）
          data-gwb-status-layer=""
          // 改名 / 起名时 Esc 只弃输入，不关面板（radix 的 Esc 监听在 document 的捕获阶段，比输入框先听到）
          onEscapeKeyDown={(e) => {
            if (renaming !== null || naming !== null) e.preventDefault()
          }}
        >
          <div className="shell:max-h-[60vh] shell:overflow-y-auto">
            {sections.map((section) => (
              <div
                key={section.desktop}
                data-gwb-desk-section={section.desktop}
                className={`shell:rounded ${over === section.desktop ? 'shell:bg-accent' : ''}`}
                {...dropZone(section.desktop, { desktop: section.desktop })}
              >
                <div
                  role="button"
                  tabIndex={0}
                  data-gwb-desk={section.desktop}
                  title="点一下切过去；右键改名"
                  className={`${ROW} shell:hover:bg-accent`}
                  onClick={() => {
                    changeOpen(false)
                    onSwitch(section.desktop)
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter') {
                      changeOpen(false)
                      onSwitch(section.desktop)
                    }
                    if (e.key === 'F2') setRenaming({ id: section.desktop, value: section.name })
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setRenaming({ id: section.desktop, value: section.name })
                  }}
                >
                  <Monitor className="shell:size-3.5 shell:shrink-0" />
                  {renaming?.id === section.desktop ? (
                    renameInput(section.desktop, renaming.value)
                  ) : (
                    <span className="shell:flex-1 shell:truncate shell:font-medium">{section.name}</span>
                  )}
                  {section.current && <span className="shell:text-muted-foreground shell:text-[10px]">当前</span>}
                  {sections.length > 1 && (
                    <button
                      type="button"
                      data-gwb-desk-delete={section.desktop}
                      title="删除这张桌面（先确认）"
                      aria-label={`删除${section.name}`}
                      className="shell:text-muted-foreground shell:hover:text-foreground shell:rounded shell:p-0.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        askDelete(section)
                      }}
                    >
                      <Trash2 className="shell:size-3" />
                    </button>
                  )}
                </div>
                {section.rows.length === 0 ? (
                  <div className={`${ROW} shell:pl-7 shell:text-muted-foreground`}>空桌面</div>
                ) : (
                  section.rows.map((pane) => {
                    const Icon = iconFor(pane.icon)
                    return (
                      <div
                        key={pane.instance}
                        role="button"
                        tabIndex={0}
                        draggable
                        data-gwb-pane={pane.instance}
                        title="点一下激活；拖到别的桌面上就送过去（按住 Shift 放下就跟过去）"
                        className={`${ROW} shell:pl-7 shell:hover:bg-accent`}
                        onDragStart={(e) => startRowDrag(e, pane.instance, pane.desktop)}
                        onDragEnd={() => {
                          endRowDrag()
                          setOver(null)
                        }}
                        onClick={() => {
                          changeOpen(false)
                          onFocusPane(pane.desktop, pane.instance)
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          changeOpen(false)
                          onFocusPane(pane.desktop, pane.instance)
                        }}
                      >
                        <Icon className="shell:size-3.5 shell:shrink-0" />
                        {pane.preview && (
                          <span
                            role="img"
                            aria-label="预览格"
                            className="shell:size-2 shell:shrink-0 shell:rounded-full shell:border shell:border-current"
                          />
                        )}
                        <span className="shell:flex-1 shell:truncate">{pane.title}</span>
                      </div>
                    )
                  })
                )}
              </div>
            ))}
          </div>
          <div className="shell:bg-border shell:-mx-1 shell:my-1 shell:h-px" />
          {naming !== null ? (
            <input
              className="shell:bg-background shell:h-7 shell:w-full shell:rounded shell:px-2 shell:text-xs shell:text-foreground shell:outline-none"
              value={naming}
              autoFocus
              placeholder="桌面名（Enter 建，Esc 弃）"
              onChange={(e) => setNaming(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNew()
                if (e.key === 'Escape') setNaming(null)
              }}
              onBlur={commitNew}
            />
          ) : (
            <div
              role="button"
              tabIndex={0}
              data-gwb-desk-new=""
              title="新建一张空桌面并切过去；把窗格拖到这儿就送到一张新桌面"
              className={`${ROW} shell:hover:bg-accent ${over === '' ? 'shell:bg-accent' : ''}`}
              onClick={() => setNaming('')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setNaming('')
              }}
              {...dropZone('', { newDesktop: '' })}
            >
              <Plus className="shell:size-3.5" />
              新建桌面…
            </div>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
        <AlertDialogContent data-gwb-desk-confirm="">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmText?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmText?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming !== null) onDelete(confirming.id)
                setConfirming(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
