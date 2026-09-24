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

/** 启动器里一个插件的那几个窗格；`goesTo` 是点下去去哪（「当前桌面」或那张桌面的名字），没有就是开一份新的 */
export interface LaunchGroup {
  entryId: string
  title: string
  rows: { spec: OpenableSpec; goesTo?: string }[]
}

/** 状态栏各项共用的外观 */
const CELL =
  'shell:flex shell:h-6 shell:items-center shell:gap-1.5 shell:rounded-full shell:px-2.5 shell:text-xs shell:text-muted-foreground'
const BUTTON = `${CELL} shell:cursor-default shell:select-none shell:hover:bg-accent shell:hover:text-accent-foreground`

/** 「布局」菜单：已存布局、存当前为布局（该项变内联输入框）、重置 */
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

  /** 空名、纯空白不存 */
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
        placeholder="布局名（Enter 保存，Esc 取消）"
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
      <DropdownMenuTrigger className={BUTTON} title="布局：保存当前布局 / 打开已保存的布局 / 重置">
        <LayoutGrid className="shell:size-3.5" />
        布局
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>已保存的布局</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {saved.length === 0 ? (
          <DropdownMenuItem disabled>还没有保存过布局</DropdownMenuItem>
        ) : (
          saved.map((row) => (
            <DropdownMenuItem key={row.id} onSelect={() => onApply(row)}>
              <span className="shell:flex-1">{row.name}</span>
              <span
                role="button"
                tabIndex={-1}
                className="shell:hover:bg-accent shell:ml-2 shell:rounded shell:px-1 shell:text-[10px]"
                title="删除这个布局"
                onClick={(e) => {
                  // 不冒泡成选中这一项，否则会应用这套布局
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
        <DropdownMenuItem onSelect={() => setNaming('')}>把当前布局另存为…</DropdownMenuItem>
        <DropdownMenuItem onSelect={onReset}>重置布局（当前桌面回到默认布局）</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 「新建」启动器：每次点开当场取注册表；选了之后菜单不关，开完静默重新读取一次 */
function Launcher({
  onList,
  onLaunch,
}: {
  onList: () => Promise<LaunchGroup[]>
  onLaunch: (spec: OpenableSpec) => Promise<void>
}): ReactElement {
  const [groups, setGroups] = useState<LaunchGroup[] | null>(null)
  // 连着点开两次时只认最后一次取回的
  const round = useRef(0)
  /** `quiet`：开完之后的那次重新读取，旧清单先留着，不闪「正在读取注册表…」 */
  const load = (quiet = false): void => {
    const mine = ++round.current
    if (!quiet) setGroups(null)
    void onList().then((next) => {
      if (round.current === mine) setGroups(next)
    })
  }
  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger className={BUTTON} title="新建：打开一个窗格（每次打开菜单都重新读取注册表）">
        <Plus className="shell:size-3.5" />
        新建
      </DropdownMenuTrigger>
      {/* 点了开在别的桌面上的工具会切桌面，那时菜单还开着，body 检查要跳过它 */}
      <DropdownMenuContent align="start" side="top" data-gwb-launcher="" data-gwb-status-layer="">
        {groups === null ? (
          <DropdownMenuItem disabled>正在读取注册表…</DropdownMenuItem>
        ) : groups.length === 0 ? (
          <DropdownMenuItem disabled>还没有插件注册窗格</DropdownMenuItem>
        ) : (
          groups.map((group, i) => (
            <Fragment key={group.entryId}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="shell:text-muted-foreground shell:text-xs">{group.title}</DropdownMenuLabel>
              {group.rows.map(({ spec, goesTo }) => {
                const Icon = iconFor(spec.icon)
                return (
                  <DropdownMenuItem
                    key={spec.id}
                    data-gwb-launch={spec.id}
                    data-gwb-launch-goes={goesTo ?? ''}
                    onSelect={(e) => {
                      // 拦下「选中就关」
                      e.preventDefault()
                      void onLaunch(spec).then(() => load(true))
                    }}
                  >
                    {/* 去已开的那几行左边一道色条；别的行留同宽空位，图标对齐 */}
                    <span
                      aria-hidden
                      className={`shell:-ml-1 shell:h-4 shell:w-0.5 shell:shrink-0 shell:rounded-full ${goesTo === undefined ? '' : 'shell:bg-primary'}`}
                    />
                    <Icon />
                    <span className="shell:flex-1">{spec.title}</span>
                    {goesTo === undefined ? (
                      <span className="shell:text-muted-foreground shell:ml-2 shell:text-xs" title="再打开一个">
                        ＋
                      </span>
                    ) : (
                      <span className="shell:ml-2 shell:text-[10px]" title={`切到已经打开的那一个（在${goesTo === '当前桌面' ? '当前桌面' : `『${goesTo}』`}）`}>
                        → {goesTo}
                      </span>
                    )}
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
  notice,
  onFollowNotice,
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
  /** 每次点开当场取；行尾记号由上游问 `planLaunch` 得出 */
  onLaunchList: () => Promise<LaunchGroup[]>
  /** 异步：开在别的桌面上的工具窗格要切过去，可能先挂载容器 */
  onLaunch: (spec: OpenableSpec) => Promise<void>
  /** 所有桌面与各自开着的窗格，照桌面顺序 */
  onSections: () => DeskSection[]
  /** 每保存一次加一 */
  panesTick: number
  onFocusPane: (desktop: string, instance: string) => void
  /** 拖到当前桌面就是拉到本桌；follow 是放下时按住了 Shift */
  onSendPane: (instance: string, to: SendTarget, follow: boolean) => Promise<void>
  /** 「<text> · 切过去」，点它切到那张桌面 */
  notice: { desktop: string; text: string } | null
  onFollowNotice: (desktop: string) => void
  onRenameDesktop: (id: string, name: string) => void
  onDeleteDesktop: (id: string) => void
  /** home 目录的绝对路径 */
  home: string
  versions: Versions
  desktops: readonly DesktopRow[]
  activeDesktopId: string
  onSwitchDesktop: (id: string) => void
  /** 新建桌面并切过去；空名由外壳用缺省名 */
  onNewDesktop: (name: string) => void
  savedLayouts: readonly SavedLayout[]
  /** 最近一次保存布局失败时显示告警项，点它重试 */
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
    // 令牌整套跟着 html.dark 换，不用重新构建
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    // z 高过桌面上的模态遮罩，状态栏永远可点；pointer-events 显式给 auto，radix 模态对 body 加的锁不跟桌面走
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

      {/* 当前桌面不变，点它才切过去 */}
      {notice !== null && (
        <button type="button" className={BUTTON} data-gwb-notice={notice.desktop} onClick={() => onFollowNotice(notice.desktop)}>
          <Send className="shell:size-3.5" />
          {notice.text}· 切过去
        </button>
      )}

      <span className="shell:flex-1" />

      {saveFailed && (
        <button
          type="button"
          className={`${BUTTON} shell:text-destructive`}
          title="布局保存失败——单击立即重试"
          onClick={onRetrySave}
        >
          <TriangleAlert className="shell:size-3.5" />
          布局保存失败
        </button>
      )}

      {/* home 只显示最后一段，全路径与各项版本在悬停提示里 */}
      <div className={CELL} title={`${home}\n${version.title}`}>
        <FolderOpen className="shell:size-3.5" />
        <span className="shell:font-mono">{home.split(/[\\/]/).filter(Boolean).at(-1) ?? home}</span>
        <span aria-hidden>·</span>
        <span className="shell:font-mono">{version.label}</span>
      </div>

      {/* 整页 reload，不是外壳内部重建 */}
      <button
        type="button"
        className={BUTTON}
        title="刷新界面：重新加载整个页面——重新读取注册表、按布局文件恢复布局（主进程不重启）"
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
