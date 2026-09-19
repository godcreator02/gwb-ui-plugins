import { Fragment, useRef, useState, type ReactElement } from 'react'
import { FolderOpen, LayoutGrid, Moon, Plus, RefreshCw, Send, Sun, TriangleAlert } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SendTarget } from './open.js'
import type { DesktopRow, SavedLayout } from '../layout.js'
import type { OpenableSpec } from '../openable.js'
import type { DeskSection } from '../pane-list.js'
import type { Versions } from '../protocol.js'
import { versionCell } from '../versions.js'
import { DesktopPanel } from './DesktopPanel.js'
import { iconFor } from './icon.js'

/**
 * 井底下那条。**它是唯一不进窗格系统的东西**——也正因如此它兜得住「窗格全关光了怎么办」，
 * 也正因如此它是桌面切换器唯一合理的落点：它不属于任何一口桌面，站在所有井外面。
 *
 * 左起：「桌面」面板（所有桌面与上面的窗格，见 `DesktopPanel`）、布局菜单、「新建」（启动器）；
 * 右边：环境（home 与版本并一格）、刷新、亮暗，布局没存上时再亮一格告警。左边是能动手的，右边是
 * 只读的环境与全局开关。
 *
 * **启动与切换分开**：「新建」开一个新的（清单每次现取注册表），「桌面」面板切到已开的（列出所有
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

export function StatusBar({
  onLaunchList,
  onLaunch,
  onSections,
  panesTick,
  onFocusPane,
  onSendPane,
  sent,
  onFollowSent,
  onRenameDesktop,
  onDeleteDesktop,
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
  /**
   * 启动器的清单：每次点开现取。「本桌已开」记号**跟点下去的效果同一个判据**（上游直接问
   * `planLaunch`），不是「这一格有没有开着」——那两者会岔开，那时记号就开始说谎
   */
  onLaunchList: () => Promise<LaunchGroup[]>
  onLaunch: (spec: OpenableSpec) => void
  /** 「桌面」面板的那棵树：所有桌面与各自开着的窗格，照桌面顺序 */
  onSections: () => DeskSection[]
  /** 窗格清单变了几回（每次落盘加一）：面板开着时按它重摘 */
  panesTick: number
  onFocusPane: (desktop: string, instance: string) => void
  /** 送到别的桌面（面板里拖放；拖到当前桌面就是拉到本桌）；follow = 放下时按住了 Shift */
  onSendPane: (instance: string, to: SendTarget, follow: boolean) => Promise<void>
  /** 刚送到哪张桌面：亮一句「已送到『X』· 切过去」，点它切过去 */
  sent: { desktop: string; name: string } | null
  onFollowSent: (desktop: string) => void
  onRenameDesktop: (id: string, name: string) => void
  onDeleteDesktop: (id: string) => void
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
      <DesktopPanel
        triggerClassName={BUTTON}
        desktops={desktops}
        activeId={activeDesktopId}
        onSections={onSections}
        panesTick={panesTick}
        onSwitch={onSwitchDesktop}
        onFocusPane={onFocusPane}
        onSend={onSendPane}
        onNew={onNewDesktop}
        onRename={onRenameDesktop}
        onDelete={onDeleteDesktop}
      />

      <LayoutBar
        saved={savedLayouts}
        onApply={onApplyLayout}
        onSave={onSaveLayout}
        onDelete={onDeleteLayout}
        onReset={onResetLayout}
      />

      <Launcher onList={onLaunchList} onLaunch={onLaunch} />

      {/* 送到别的桌面之后亮一阵：当前桌面不变，点它才切过去 */}
      {sent !== null && (
        <button type="button" className={BUTTON} data-gwb-sent={sent.desktop} onClick={() => onFollowSent(sent.desktop)}>
          <Send className="shell:size-3.5" />
          已送到『{sent.name}』· 切过去
        </button>
      )}

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

      {/* 环境：在哪个 home、什么版本——两样都只读，并一格。home 只摆最后一段（路径很长，而人要认的是
          「我在哪个 home 里」）；全长与各项版本在悬停上 */}
      <div className={CELL} title={`${home}\n${version.title}`}>
        <FolderOpen className="shell:size-3.5" />
        <span className="shell:font-mono">{home.split(/[\\/]/).filter(Boolean).at(-1) ?? home}</span>
        <span aria-hidden>·</span>
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
