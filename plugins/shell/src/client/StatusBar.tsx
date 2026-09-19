import { Fragment, useRef, useState, type ReactElement } from 'react'
import { FolderOpen, Info, LayoutGrid, Monitor, Moon, PanelsTopLeft, Plus, RefreshCw, Send, Sun, TriangleAlert } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SendTarget } from './open.js'
import type { DesktopRow, SavedLayout } from '../layout.js'
import type { OpenableSpec } from '../openable.js'
import type { SwitcherGroup } from '../pane-list.js'
import type { Versions } from '../protocol.js'
import { versionCell } from '../versions.js'
import { iconFor } from './icon.js'

/**
 * 井底下那条。**它是唯一不进窗格系统的东西**——也正因如此它兜得住「窗格全关光了怎么办」，
 * 也正因如此它是桌面切换器唯一合理的落点：它不属于任何一口桌面，站在所有井外面。
 *
 * 左起：桌面切换、布局菜单、「新建」（启动器）、「窗格」（切换器）、home 路径；右边：版本、
 * 刷新、亮暗，布局没存上时再亮一格告警。
 *
 * **启动与切换分开**：「新建」开一个新的（清单每次现取注册表），「窗格」切到已开的（列出所有
 * 桌面上开着的窗格）。一个列表同时干两件事，对文档窗格就说不清「点下去是开新的还是切过去」。
 */

/** 启动器里的一组：一个插件注册的那几格，工具窗格本桌已开的标一下 */
export interface LaunchGroup {
  entryId: string
  title: string
  rows: { spec: OpenableSpec; opened: boolean }[]
}

/** 一格的外观：状态栏上所有格共用，免得每处各写一套。h-6 的幽灵 pill，跟井里的标签同一套语言 */
const CELL =
  'shell:flex shell:h-6 shell:items-center shell:gap-1.5 shell:rounded-full shell:px-2.5 shell:text-xs shell:text-muted-foreground'
const BUTTON = `${CELL} shell:cursor-default shell:select-none shell:hover:bg-accent shell:hover:text-accent-foreground`

/**
 * 菜单一行里行尾的小动作（✕、拉到本桌）。不让这一下冒泡成「选中这一行」——那会走成激活它、
 * 甚至切桌面；菜单也不关，动作做完清单原地刷新
 */
function rowButton(text: string, label: string, title: string, run: () => void): ReactElement {
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={label}
      title={title}
      className="shell:hover:bg-accent shell:ml-2 shell:rounded shell:px-1 shell:text-[10px]"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        run()
      }}
    >
      {text}
    </span>
  )
}

/**
 * 桌面那一格：列出桌面、切换、新建（格子变输入框）、每一行的改名与删除。交互照 LayoutBar 那套——
 * 内联输入而不是弹窗，跟这行状态栏的分量相称；只有「删一张上面有窗格的桌面」弹确认，因为那会
 * 关掉一摊窗格。
 */
function DesktopBar({
  desktops,
  activeId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  paneCountOf,
}: {
  desktops: readonly DesktopRow[]
  activeId: string
  onSwitch: (id: string) => void
  onNew: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  paneCountOf: (id: string) => number
}): ReactElement {
  const [naming, setNaming] = useState<string | null>(null)
  /** 正在改名的那一张：格子变输入框，Enter 定、Esc 弃，空名不改 */
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  /** 等人确认删除的那一张（上面有窗格才走到这儿） */
  const [confirming, setConfirming] = useState<{ id: string; name: string; panes: number } | null>(null)
  const [open, setOpen] = useState(false)
  const active = desktops.find((d) => d.id === activeId)

  /** 提交新桌面名。空名 / 纯空白照收——外壳会拿缺省名「桌面 N」顶上，那不是没起，是懒得起 */
  const commit = (): void => {
    if (naming === null) return
    onNew(naming.trim())
    setNaming(null)
  }

  /** 删除：只剩一张删不了；空桌面直接删；上面有窗格先确认 */
  const askDelete = (row: DesktopRow): void => {
    setOpen(false)
    const panes = paneCountOf(row.id)
    if (panes === 0) onDelete(row.id)
    else setConfirming({ id: row.id, name: row.name, panes })
  }

  /** 行尾的一个小动作：不让这一下冒泡成「选中这一行」（那会走成切桌面） */
  const rowAction = (label: string, title: string, run: () => void, disabled = false): ReactElement => (
    <span
      role="button"
      tabIndex={-1}
      aria-disabled={disabled}
      data-gwb-desk-action={label}
      title={title}
      className={`shell:ml-1 shell:rounded shell:px-1 shell:text-[10px] ${disabled ? 'shell:opacity-40' : 'shell:hover:bg-accent'}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) run()
      }}
    >
      {label}
    </span>
  )

  const confirmDialog = (
    <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
      <AlertDialogContent data-gwb-desk-confirm="">
        <AlertDialogHeader>
          <AlertDialogTitle>删除『{confirming?.name}』？</AlertDialogTitle>
          <AlertDialogDescription>上面 {confirming?.panes} 个窗格会一起关掉。</AlertDialogDescription>
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
  )

  if (renaming !== null) {
    return (
      <input
        className="shell:bg-background shell:h-6 shell:w-36 shell:rounded-full shell:px-2.5 shell:text-xs shell:text-foreground shell:outline-none"
        value={renaming.value}
        autoFocus
        data-gwb-desk-rename={renaming.id}
        placeholder="桌面名（Enter 定，Esc 弃）"
        onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onRename(renaming.id, renaming.value)
            setRenaming(null)
          }
          if (e.key === 'Escape') setRenaming(null)
        }}
        onBlur={() => setRenaming(null)}
      />
    )
  }

  if (naming !== null) {
    return (
      <input
        className="shell:bg-background shell:h-6 shell:w-36 shell:rounded-full shell:px-2.5 shell:text-xs shell:text-foreground shell:outline-none"
        value={naming}
        autoFocus
        placeholder="桌面名（Enter 建，Esc 弃）"
        onChange={(e) => setNaming(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setNaming(null)
        }}
        onBlur={commit}
      />
    )
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger className={BUTTON} title="桌面：切换 / 新建 / 改名 / 删除（井常驻保活，切走的那口原样活着）">
          <Monitor className="shell:size-3.5" />
          {active?.name ?? '桌面'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" data-gwb-desktops="">
          <DropdownMenuLabel>桌面</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {desktops.map((row) => (
            <DropdownMenuItem key={row.id} data-gwb-desk={row.id} onSelect={() => onSwitch(row.id)}>
              <span className="shell:flex-1">{row.name}</span>
              {/* 活动的不 disable——再点一次是幂等的；标出来是让人认得出自己在哪口 */}
              {row.id === activeId && <span className="shell:text-muted-foreground shell:ml-2 shell:text-[10px]">当前</span>}
              {rowAction('改名', '给这张桌面改名', () => {
                setOpen(false)
                setRenaming({ id: row.id, value: row.name })
              })}
              {rowAction('删除', desktops.length < 2 ? '只剩这一张，删不了' : '删掉这张桌面，上面的窗格一起关掉', () => askDelete(row), desktops.length < 2)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNaming('')}>新建桌面…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  )
}

/**
 * 布局那一格：已存布局清单（点谁铺谁）＋ 存当前为布局（格子变输入框）＋ 重置。
 * 存名字是内联输入，不是弹窗——跟这行状态栏的分量相称。
 */
function LayoutBar({
  saved,
  onApply,
  onSave,
  onDelete,
  onReset,
}: {
  saved: readonly SavedLayout[]
  onApply: (row: SavedLayout) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
  onReset: () => void
}): ReactElement {
  const [naming, setNaming] = useState<string | null>(null)

  /** 提交存名。空名 / 纯空白不存——那不是一套布局的名字，是没起 */
  const commit = (): void => {
    if (naming === null) return
    const name = naming.trim()
    if (name !== '') onSave(name)
    setNaming(null)
  }

  if (naming !== null) {
    return (
      <input
        className="shell:bg-background shell:h-6 shell:w-36 shell:rounded-full shell:px-2.5 shell:text-xs shell:text-foreground shell:outline-none"
        value={naming}
        autoFocus
        placeholder="布局名（Enter 存，Esc 弃）"
        onChange={(e) => setNaming(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setNaming(null)
        }}
        onBlur={commit}
      />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={BUTTON} title="布局：存当前 / 打开已存的 / 重置">
        <LayoutGrid className="shell:size-3.5" />
        布局
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>已存的布局</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {saved.length === 0 ? (
          <DropdownMenuItem disabled>还没有存过布局</DropdownMenuItem>
        ) : (
          saved.map((row) => (
            <DropdownMenuItem key={row.id} onSelect={() => onApply(row)}>
              <span className="shell:flex-1">{row.name}</span>
              <span
                role="button"
                tabIndex={-1}
                className="shell:hover:bg-accent shell:ml-2 shell:rounded shell:px-1 shell:text-[10px]"
                title="删掉这套"
                onClick={(e) => {
                  // 别让这一下冒泡成「选中这一项」——那会走成应用这套布局
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(row.id)
                }}
              >
                ✕
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setNaming('')}>存当前为布局…</DropdownMenuItem>
        <DropdownMenuItem onSelect={onReset}>重置布局（铺回全部格）</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 「新建」：启动器。**每次点开都现取注册表**（热装的件不用刷新就在），按插件分组列出全部窗格
 * 定义。文档窗格选了就开一份新的；工具窗格本桌已开就激活它（那一行标「本桌已开」）。都开在
 * 当前桌面，不切桌面。
 */
function Launcher({
  onList,
  onLaunch,
}: {
  onList: () => Promise<LaunchGroup[]>
  onLaunch: (spec: OpenableSpec) => void
}): ReactElement {
  const [groups, setGroups] = useState<LaunchGroup[] | null>(null)
  // 连着点开两次：只认最后一次取回来的那份
  const round = useRef(0)
  const load = (): void => {
    const mine = ++round.current
    setGroups(null)
    void onList().then((next) => {
      if (round.current === mine) setGroups(next)
    })
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger className={BUTTON} title="新建：开一个窗格（清单每次现取注册表）">
        <Plus className="shell:size-3.5" />
        新建
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" data-gwb-launcher="">
        {groups === null ? (
          <DropdownMenuItem disabled>取注册表…</DropdownMenuItem>
        ) : groups.length === 0 ? (
          <DropdownMenuItem disabled>没有件注册过窗格</DropdownMenuItem>
        ) : (
          groups.map((group, i) => (
            <Fragment key={group.entryId}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="shell:text-muted-foreground shell:text-xs">{group.title}</DropdownMenuLabel>
              {group.rows.map(({ spec, opened }) => {
                const Icon = iconFor(spec.icon)
                return (
                  <DropdownMenuItem key={spec.id} data-gwb-launch={spec.id} onSelect={() => onLaunch(spec)}>
                    <Icon />
                    <span className="shell:flex-1">{spec.title}</span>
                    {opened && <span className="shell:text-muted-foreground shell:ml-2 shell:text-[10px]">本桌已开</span>}
                  </DropdownMenuItem>
                )
              })}
            </Fragment>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 「窗格 N」：切换器，N 是当前桌面上的窗格数。点开按桌面分组列出**所有桌面**上开着的窗格，
 * 当前桌面在最前、标「当前」。点当前桌面的一行激活它；点别的桌面的一行切过去再激活（显式
 * 切换）。行尾「关闭」关掉它，不切桌面。这是跨桌面找窗格的唯一入口。
 */
function Switcher({
  count,
  onList,
  onFocus,
  onClose,
  onSend,
  onPull,
}: {
  count: number
  onList: () => SwitcherGroup[]
  onFocus: (desktop: string, instance: string) => void
  onClose: (desktop: string, instance: string) => Promise<void>
  onSend: (instance: string, to: SendTarget, follow: boolean) => Promise<void>
  onPull: (instance: string) => Promise<void>
}): ReactElement {
  const [groups, setGroups] = useState<SwitcherGroup[]>([])
  const refresh = (): void => setGroups(onList())
  /** 选「送到」那一项时按没按住 Shift：按住就送完跟过去 */
  const shiftRef = useRef(false)
  const noteShift = (e: { shiftKey: boolean }): void => {
    shiftRef.current = e.shiftKey
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && refresh()}>
      <DropdownMenuTrigger className={BUTTON} title="窗格：所有桌面上开着的窗格，点一行激活（在别的桌面就切过去）">
        <PanelsTopLeft className="shell:size-3.5" />
        窗格 {count}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" data-gwb-switcher="">
        {groups.map((group, i) => (
          <Fragment key={group.desktop}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="shell:flex shell:items-center shell:text-muted-foreground shell:text-xs">
              <span className="shell:flex-1">{group.name}</span>
              {group.current && <span className="shell:ml-2 shell:text-[10px]">当前</span>}
            </DropdownMenuLabel>
            {group.rows.length === 0 ? (
              <DropdownMenuItem disabled>（空桌面）</DropdownMenuItem>
            ) : (
              group.rows.map((row) => {
                const Icon = iconFor(row.icon)
                const targets = groups.filter((g) => g.desktop !== row.desktop)
                return (
                  <div key={row.instance} className="shell:flex shell:items-center">
                    <DropdownMenuItem
                      className="shell:flex-1 shell:min-w-0"
                      data-gwb-pane={row.instance}
                      onSelect={() => onFocus(row.desktop, row.instance)}
                    >
                      <Icon />
                      {row.preview && (
                        <span
                          role="img"
                          aria-label="预览格"
                          className="shell:size-2 shell:shrink-0 shell:rounded-full shell:border shell:border-current"
                        />
                      )}
                      <span className="shell:flex-1 shell:truncate">{row.title}</span>
                      {!group.current &&
                        rowButton('拉到本桌', '拉到本桌', '把它挪到当前桌面', () => void onPull(row.instance).then(refresh))}
                      {rowButton('✕', '关闭', '关闭这个窗格', () => void onClose(row.desktop, row.instance).then(refresh))}
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="shell:text-[10px]" data-gwb-pane-send={row.instance}>
                        送到
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {targets.map((t) => (
                          <DropdownMenuItem
                            key={t.desktop}
                            data-gwb-send-to={t.desktop}
                            onPointerDown={noteShift}
                            onKeyDown={noteShift}
                            onSelect={() => void onSend(row.instance, { desktop: t.desktop }, shiftRef.current)}
                          >
                            {t.name}
                          </DropdownMenuItem>
                        ))}
                        {targets.length > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          data-gwb-send-to=""
                          onPointerDown={noteShift}
                          onKeyDown={noteShift}
                          onSelect={() => void onSend(row.instance, { newDesktop: '' }, shiftRef.current)}
                        >
                          新桌面
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </div>
                )
              })
            )}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StatusBar({
  paneCount,
  onLaunchList,
  onLaunch,
  onListPanes,
  onFocusPane,
  onClosePane,
  onSendPane,
  onPullPane,
  sent,
  onFollowSent,
  onRenameDesktop,
  onDeleteDesktop,
  paneCountOf,
  home,
  versions,
  desktops,
  activeDesktopId,
  savedLayouts,
  saveFailed,
  onSwitchDesktop,
  onNewDesktop,
  onApplyLayout,
  onSaveLayout,
  onDeleteLayout,
  onResetLayout,
  onRetrySave,
}: {
  /** 当前桌面上开着几个窗格（「窗格 N」那个 N） */
  paneCount: number
  /**
   * 启动器的清单：每次点开现取。「本桌已开」记号**跟点下去的效果同一个判据**（上游直接问
   * `planLaunch`），不是「这一格有没有开着」——那两者会岔开，那时记号就开始说谎
   */
  onLaunchList: () => Promise<LaunchGroup[]>
  onLaunch: (spec: OpenableSpec) => void
  /** 切换器的清单：所有桌面上开着的窗格 */
  onListPanes: () => SwitcherGroup[]
  onFocusPane: (desktop: string, instance: string) => void
  onClosePane: (desktop: string, instance: string) => Promise<void>
  /** 送到别的桌面（切换器行尾「送到」）；follow = 送完跟过去（选的时候按住 Shift） */
  onSendPane: (instance: string, to: SendTarget, follow: boolean) => Promise<void>
  /** 拉到本桌（切换器里别的桌面上那一行） */
  onPullPane: (instance: string) => Promise<void>
  /** 刚送到哪张桌面：亮一句「已送到『X』· 切过去」，点它切过去 */
  sent: { desktop: string; name: string } | null
  onFollowSent: (desktop: string) => void
  onRenameDesktop: (id: string, name: string) => void
  onDeleteDesktop: (id: string) => void
  /** 某张桌面上开着几个窗格（删之前弹确认要用） */
  paneCountOf: (desktop: string) => number
  /** home 目录的绝对路径 */
  home: string
  /** 版本那一格：格子上写产品版本（内核版），悬停列内核、外壳、运行时 */
  versions: Versions
  /** 桌面清单与活动桌面 id。井常驻保活，切换只是换哪口显示 */
  desktops: readonly DesktopRow[]
  activeDesktopId: string
  onSwitchDesktop: (id: string) => void
  /** 新建桌面并切过去。空名由外壳拿缺省名顶上 */
  onNewDesktop: (name: string) => void
  /** 人起名存下来的布局清单 */
  savedLayouts: readonly SavedLayout[]
  /** 布局档最后一次落盘成没成。失败亮一格，点一下重试 */
  saveFailed: boolean
  onApplyLayout: (row: SavedLayout) => void
  onSaveLayout: (name: string) => void
  onDeleteLayout: (id: string) => void
  onResetLayout: () => void
  onRetrySave: () => void
}): ReactElement {
  const version = versionCell(versions)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggleDark = (): void => {
    const next = !dark
    setDark(next)
    // 令牌整套跟着换：井底、标签条、件里的东西一起变，一行都不用重新构建
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    // z 压过本桌的模态遮罩（状态栏永远可点，含从模态里切桌面逃出）；pointer-events
    // 显式给 auto 不靠 body 继承——radix 模态锁 body 的那把锁不跟桌面走。判据见文档站
    <footer className="shell:relative shell:z-[60] shell:pointer-events-auto shell:bg-card shell:text-card-foreground shell:flex shell:h-8 shell:flex-none shell:items-center shell:gap-0.5 shell:border-t shell:px-1 shell:text-xs">
      <DesktopBar
        desktops={desktops}
        activeId={activeDesktopId}
        onSwitch={onSwitchDesktop}
        onNew={onNewDesktop}
        onRename={onRenameDesktop}
        onDelete={onDeleteDesktop}
        paneCountOf={paneCountOf}
      />

      <LayoutBar
        saved={savedLayouts}
        onApply={onApplyLayout}
        onSave={onSaveLayout}
        onDelete={onDeleteLayout}
        onReset={onResetLayout}
      />

      <Launcher onList={onLaunchList} onLaunch={onLaunch} />
      <Switcher
        count={paneCount}
        onList={onListPanes}
        onFocus={onFocusPane}
        onClose={onClosePane}
        onSend={onSendPane}
        onPull={onPullPane}
      />

      {/* 送到别的桌面之后亮一阵：当前桌面不变，点它才切过去 */}
      {sent !== null && (
        <button type="button" className={BUTTON} data-gwb-sent={sent.desktop} onClick={() => onFollowSent(sent.desktop)}>
          <Send className="shell:size-3.5" />
          已送到『{sent.name}』· 切过去
        </button>
      )}

      <div className={CELL} title={home}>
        <FolderOpen className="shell:size-3.5" />
        {/* 只摆最后一段:路径很长,而人要认的是「我在哪个 home 里」。全长在 title 上 */}
        <span className="shell:font-mono">{home.split(/[\\/]/).filter(Boolean).at(-1) ?? home}</span>
      </div>

      <span className="shell:flex-1" />

      {saveFailed && (
        <button
          type="button"
          className={`${BUTTON} shell:text-destructive`}
          title="布局没存上——点一下立刻重试一次"
          onClick={onRetrySave}
        >
          <TriangleAlert className="shell:size-3.5" />
          布局没存上
        </button>
      )}

      <div className={CELL} title={version.title}>
        <Info className="shell:size-3.5" />
        <span className="shell:font-mono">{version.label}</span>
      </div>

      {/* 整页 reload，不是外壳内部重建：boot 链原样重跑，boot 后才变的注册表之类
          全吃到；内核那半不受影响 */}
      <button
        type="button"
        className={BUTTON}
        title="刷新界面：整页重跑——重取注册表、按档恢复布局（宿主进程不动）"
        onClick={() => location.reload()}
      >
        <RefreshCw className="shell:size-3.5" />
        刷新
      </button>

      <button type="button" className={BUTTON} onClick={toggleDark} title={dark ? '切到亮色' : '切到暗色'}>
        {dark ? <Sun className="shell:size-3.5" /> : <Moon className="shell:size-3.5" />}
        {dark ? '亮色' : '暗色'}
      </button>
    </footer>
  )
}
