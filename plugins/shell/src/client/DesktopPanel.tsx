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

/** 拖着标签在状态栏「桌面」项上停多久，面板自己弹开 */
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
  /** 状态栏各项共用的外观 */
  triggerClassName: string
  desktops: readonly DesktopRow[]
  activeId: string
  /** 所有桌面与各自开着的窗格，照桌面顺序；每次点开、每次拖放完当场读取 */
  onSections: () => DeskSection[]
  /** 外壳每保存一次加一，面板开着时据此重新读取 */
  panesTick: number
  onSwitch: (id: string) => void
  onFocusPane: (desktop: string, instance: string) => void
  /** 送到别的桌面（拖放）；follow = 放下时按住了 Shift */
  onSend: (instance: string, to: SendTarget, follow: boolean) => Promise<void>
  /** 新建桌面并切过去；空名由外壳用缺省名 */
  onNew: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}): ReactElement {
  const [open, setOpen] = useState(false)
  const [sections, setSections] = useState<DeskSection[]>([])
  /** 正在改名的桌面：Enter 确认，Esc 或失焦放弃，空名不改 */
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  /** 「新建桌面…」那一行正在输入的名字 */
  const [naming, setNaming] = useState<string | null>(null)
  /** 等待确认删除的桌面 */
  const [confirming, setConfirming] = useState<{ id: string; name: string; panes: number } | null>(null)
  /** 拖着的窗格此刻悬在哪个落点上（桌面 id；空串是「新建桌面」） */
  const [over, setOver] = useState<string | null>(null)
  const spring = useRef<number | undefined>(undefined)
  const active = desktops.find((d) => d.id === activeId)

  /** 送到是异步的（可能要先在后台挂载容器），桌面清单不一定变，送完自己重新读取 */
  const refresh = (): void => setSections(onSections())
  // 依赖里故意没有 onSections：它每轮都是新函数；清单的变化由这四项带进来
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

  /** 到点再问一次还在拖没有：已经松手或按 Esc 取消了就不弹开 */
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
      void onSend(pane.instance, to, e.shiftKey).then(refresh, (err: unknown) => {
        console.error(`[shell] 拖到别的桌面失败：${String(err)}`)
      })
    },
  })

  /** 确认框是模态的、叠在面板上面，点确认框不算点面板外面，面板不关 */
  const askDelete = (section: DeskSection): void => {
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
      // 输入框在桌面那一行里，点它不冒泡成切过去
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
          // 状态栏自己的浮层挂在 body 上，切桌面后的 body 检查（sweepBodyPortals）据此跳过它
          data-gwb-status-layer=""
          // 改名、起名时 Esc 只放弃输入不关面板：radix 的 Esc 监听在 document 的捕获阶段，比输入框先收到
          onEscapeKeyDown={(e) => {
            if (renaming !== null || naming !== null) e.preventDefault()
          }}
          // 只有点外面才关：切桌面、激活窗格时焦点被挪走不算
          onFocusOutside={(e) => e.preventDefault()}
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
                  onClick={() => onSwitch(section.desktop)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter') onSwitch(section.desktop)
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
                        onClick={() => onFocusPane(pane.desktop, pane.instance)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onFocusPane(pane.desktop, pane.instance)
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
