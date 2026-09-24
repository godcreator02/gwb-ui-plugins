import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
// 页面上 `window.gwb` 的类型：词汇表包的全局声明，import 它就生效。实时日志经 `window.gwb.on` 订阅
import type {} from '@godcreator/gwb-plugin-api'
import {
  acceptEntries,
  clockOf,
  LEVELS,
  mergeEntries,
  type LogEntry,
  type LogLevel,
  type LogSource,
} from './entries'
import { ALL_SOURCES, countBySource, groupNames, matches, type FilterState } from './filter'
import { ScrollText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * 浏览器侧：日志窗格。
 *
 * **实时日志不经 `args`**——`mountPane` 只给 `{ host, shell, pane }`，实时日志订阅的是
 * 页面的公共接口 `window.gwb.on`：node 侧经 `gwbKernel.emit` 推送，载荷带本插件的标记 `t`。
 * 外壳不转发它，因为外壳不该认识「日志」。历史段与脚注里的路径才走 `args.host` 的命令。
 *
 * 版面（**以本文件为准**，仓里没有另外的设计稿）：日志行用 grid 定宽列对齐、error/warn
 * 整行色调加左边色条、级别分段控件显示门限、来源胶囊开关、吸附提示浮在右下角。
 * 行为语义：级别门限、来源多选、复合键、seq 去重、吸附、超上限丢最早的行、空态两种文案。
 *
 * 类名一律带 `baseui:` 前缀——样式隔离靠的就是这个前缀（见 `../../styles.css`）。漏加没有任何
 * 报错：那个类不生成任何 CSS，页面上就是那一处没样式，构建照样通过，所以
 * `tests/prefix.test.ts` 那条测试把源码里每个字符串 token 逐个试编译。
 *
 * ⚠️ **本窗格在接收日志的路径上不许调用 `console`。** 渲染层的 console 是三个日志来源之一：
 * 打一条 → 主进程收集 → 进缓冲 → 推回本窗格 → 这条路径上再打一条，条数就成倍增长，
 * 界面当场卡死。取历史段失败这类一次性、不在循环路径上的错误，也显示在界面上，不打 console。
 */

/** 本窗格最多保留多少行。**由渲染成本决定**，不是缓冲大小——内核的缓冲比这个大，更早的去日志文件查 */
const CAP = 2000

/** 离底部多少像素以内算作吸附（跟随最新行） */
const STICK_SLACK = 24

/** 「全部来源」那一项的值。Radix 的 SelectItem **不接受空串**，得给它一个非空值 */
const ALL_KEY = '*'

const SOURCE_LABEL: Record<LogSource, string> = { plugin: '件', kernel: '核', renderer: '渲' }

/**
 * 三个来源的圆点颜色：**插件域令牌**——tokens.css 里的三个 --baseui-src-*，由入口末尾的
 * @theme 段注册成 bg-src-* 类。用在两处：来源胶囊上的小圆点、每行来源标记上的小圆点，让
 * 筛选开关和日志行用同一种颜色对应同一个来源。值只在 tokens.css 定义，这里只写类名。
 */
const SOURCE_DOT: Record<LogSource, string> = {
  plugin: 'baseui:bg-src-plugin',
  kernel: 'baseui:bg-src-kernel',
  renderer: 'baseui:bg-src-renderer',
}

/** 在内核事件里识别本插件事件的标记，与 node 侧的 EVENT 是同一个字符串 */
const EVENT = 'gwb-logger'
const BACKLOG_COMMAND = 'logger.backlog'
const WHERE_COMMAND = 'logger.where'

const LEVEL_MARK: Record<LogLevel, string> = { error: 'E', warn: 'W', info: 'I', debug: 'D' }

const LEVEL_TEXT: Record<LogLevel, string> = { error: 'Error', warn: 'Warn', info: 'Info', debug: 'Debug' }

/** 级别字母的颜色。只有 error/warn 有色，info/debug 显示成灰色——一行里颜色太多就没有重点了 */
const LEVEL_TONE: Record<LogLevel, string> = {
  error: 'baseui:text-destructive',
  warn: 'baseui:text-warning',
  info: 'baseui:text-muted-foreground baseui:opacity-70',
  debug: 'baseui:text-muted-foreground baseui:opacity-40',
}

/** 整行色调：error/warn 淡色底加左边色条（仿 DevTools），其余无底色、只有 hover 色 */
const ROW_TONE: Record<LogLevel, string> = {
  error:
    'baseui:bg-destructive/[0.08] baseui:shadow-[inset_2px_0_0_var(--destructive)] baseui:hover:bg-destructive/[0.14]',
  warn: 'baseui:bg-warning/[0.07] baseui:shadow-[inset_2px_0_0_var(--warning)] baseui:hover:bg-warning/[0.12]',
  info: 'baseui:hover:bg-accent',
  debug: 'baseui:hover:bg-accent',
}

function LoggerPane({ args }: { args: PaneArgs }): ReactElement {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [failed, setFailed] = useState('')
  const [where, setWhere] = useState<{ home: string; logDir: string } | null>(null)
  const [filter, setFilter] = useState<FilterState>({
    level: 'debug',
    sources: ALL_SOURCES,
    key: '',
    search: '',
  })
  const [stick, setStick] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const take = (batch: unknown): void => {
      if (!alive) return
      setEntries((prev) => mergeEntries(prev, acceptEntries(batch), CAP))
    }
    // **先订阅、后取历史**：反过来的话，历史截止到订阅生效之间推来的条目会漏掉。
    // 两段交叠的部分靠 seq 去重。内核事件里有所有插件的事件，只处理带本插件标记的
    const off = window.gwb.on((payload) => {
      if (payload === null || typeof payload !== 'object') return
      const p = payload as { t?: unknown; line?: unknown }
      // 桌面切走时收到的直接丢弃——本窗格仍常驻，只是不显示；node 侧照常缓冲，
      // 切回时重取历史段补上（见下面的 onVisibility）
      if (p.t === EVENT && visibleRef.current) take([p.line])
    })
    args.host.call(BACKLOG_COMMAND).then(
      (res) => {
        const r = res as { ok?: boolean; data?: unknown; error?: string }
        if (r.ok === true) take(r.data)
        else if (alive) setFailed(`历史段取不到：${r.error ?? '没说原因'}`)
      },
      (err: unknown) => {
        if (alive) setFailed(`历史段取不到：${String(err)}`)
      },
    )
    return () => {
      alive = false
      off()
    }
  }, [])

  // 协作式降级（`shell.onVisibility`）：桌面切走时停止渲染——实时事件直接丢弃、不再重算；
  // 切回时重取一次历史段补上丢掉的部分，交叠靠 seq 去重。契约只通知、不强制：不订阅也合法，
  // 只是切走后照常渲染、白白耗资源
  const visibleRef = useRef(true)
  useEffect(() => {
    const off = args.shell.onVisibility((visible) => {
      visibleRef.current = visible
      if (visible === false) return
      args.host.call(BACKLOG_COMMAND).then(
        (res) => {
          const r = res as { ok?: boolean; data?: unknown }
          if (r.ok === true) setEntries((prev) => mergeEntries(prev, acceptEntries(r.data), CAP))
        },
        () => {
          /* 补取失败不影响之后的实时事件，不报错 */
        },
      )
    })
    return off
  }, [args.host, args.shell])

  useEffect(() => {
    let alive = true
    args.host.call(WHERE_COMMAND).then(
      (res) => {
        const data = (res as { data?: { home?: string; logFile?: string } }).data
        if (alive && data !== undefined) setWhere({ home: data.home ?? '', logDir: data.logFile ?? '' })
      },
      () => {
        /* 取不到只是脚注少显示路径，不报错 */
      },
    )
    return () => {
      alive = false
    }
  }, [args.host])

  const shown = useMemo(() => entries.filter((e) => matches(e, filter)), [entries, filter])
  const counts = useMemo(() => countBySource(entries), [entries])
  const groups = useMemo(() => groupNames(entries), [entries])

  // 吸附：处于跟随状态时，每次有新行就滚到底部
  useEffect(() => {
    if (!stick) return
    const el = listRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [shown, stick])

  const toggleSource = (s: LogSource): void => {
    setFilter((f) => {
      const next = new Set(f.sources)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return { ...f, sources: next }
    })
  }

  const clearFilter = (): void => {
    setFilter({ level: 'debug', sources: ALL_SOURCES, key: '', search: '' })
  }

  // 级别分段：选中的级别实心，更严重的几级浅色高亮，表示「显示这一级及以上」
  const segTone = (l: LogLevel): string => {
    if (filter.level === l) return 'baseui:bg-primary baseui:text-primary-foreground baseui:font-medium'
    return LEVELS.indexOf(l) < LEVELS.indexOf(filter.level)
      ? 'baseui:bg-accent baseui:text-muted-foreground'
      : 'baseui:text-muted-foreground baseui:hover:text-foreground'
  }

  const filtering =
    filter.level !== 'debug' || filter.sources.size !== ALL_SOURCES.size || filter.key !== '' || filter.search !== ''

  return (
    /* baseui:relative 是「回到底部」浮动按钮的定位参照，必须放在窗格根这一层：放进滚动容器的话
       absolute+bottom 相对的是滚动内容，内容一长按钮就移出视口 */
    <div className="baseui:relative baseui:flex baseui:h-full baseui:flex-col baseui:bg-background baseui:text-foreground">
      <div className="baseui:flex baseui:flex-wrap baseui:items-center baseui:gap-1.5 baseui:border-b baseui:border-border baseui:bg-card baseui:px-2.5 baseui:py-1.5">
        <div className="baseui:flex baseui:items-center baseui:gap-0.5 baseui:rounded-lg baseui:bg-muted/60 baseui:p-0.5">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              title={`显示 ${LEVEL_TEXT[l]} 及以上`}
              onClick={() => setFilter((f) => ({ ...f, level: l }))}
              className={`baseui:rounded-md baseui:px-2.5 baseui:py-0.5 baseui:text-[11.5px] baseui:leading-5 ${segTone(l)}`}
            >
              {LEVEL_TEXT[l]}
            </button>
          ))}
        </div>

        <div className="baseui:ml-1.5 baseui:flex baseui:items-center baseui:gap-1 baseui:border-l baseui:border-border baseui:py-0.5 baseui:pl-2.5">
          {(['plugin', 'kernel', 'renderer'] as LogSource[]).map((s) => {
            const on = filter.sources.has(s)
            return (
              <button
                key={s}
                type="button"
                title={`${SOURCE_LABEL[s]}这一路`}
                onClick={() => toggleSource(s)}
                className={`baseui:inline-flex baseui:items-center baseui:gap-1.5 baseui:rounded-full baseui:px-2.5 baseui:py-0.5 baseui:text-[11.5px] baseui:leading-5 ${
                  on
                    ? 'baseui:bg-secondary baseui:text-secondary-foreground baseui:hover:bg-accent'
                    : 'baseui:text-muted-foreground baseui:opacity-55 baseui:hover:bg-accent baseui:hover:opacity-80'
                }`}
              >
                <span className={`baseui:h-1.5 baseui:w-1.5 baseui:rounded-full ${SOURCE_DOT[s]}`} />
                {SOURCE_LABEL[s]}{' '}
                <span className="baseui:text-[10.5px] baseui:tabular-nums baseui:opacity-60">{counts[s]}</span>
              </button>
            )
          })}
        </div>

        <div className="baseui:ml-1.5 baseui:flex baseui:min-w-0 baseui:flex-1 baseui:items-center baseui:gap-1.5 baseui:border-l baseui:border-border baseui:py-0.5 baseui:pl-2.5">
          <Select
            value={filter.key === '' ? ALL_KEY : filter.key}
            onValueChange={(v) => setFilter((f) => ({ ...f, key: v === ALL_KEY ? '' : v }))}
          >
            <SelectTrigger size="sm" className="baseui:w-40 baseui:shrink-0">
              <SelectValue placeholder="全部来源" />
            </SelectTrigger>
            <SelectContent container={args.shell.portal}>
              <SelectItem value={ALL_KEY}>全部来源</SelectItem>
              {groups.map((g) => (
                <SelectGroup key={g.source}>
                  <SelectLabel>{SOURCE_LABEL[g.source]}</SelectLabel>
                  {g.names.map((n) => (
                    <SelectItem key={n} value={`${g.source}|${n}`}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <div className="baseui:flex baseui:h-8 baseui:min-w-32 baseui:flex-1 baseui:items-center baseui:gap-1.5 baseui:rounded-md baseui:border baseui:border-input baseui:px-2 baseui:focus-within:border-ring">
            <Search size={12} className="baseui:shrink-0 baseui:opacity-50" aria-hidden />
            <input
              type="text"
              placeholder="搜索 name 或消息"
              className="baseui:w-full baseui:bg-transparent baseui:text-xs baseui:outline-none baseui:placeholder:text-muted-foreground"
              value={filter.search}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="baseui:shrink-0 baseui:text-muted-foreground"
            title="只清这一份视图，不动内核的缓冲，也不动日志文件。清完不会自己回来，重开这一格才会"
            onClick={() => setEntries([])}
          >
            清屏
          </Button>
        </div>
      </div>

      <div
        ref={listRef}
        className="baseui:flex-1 baseui:overflow-y-auto baseui:overflow-x-hidden"
        onScroll={() => {
          const el = listRef.current
          if (el !== null) setStick(el.scrollHeight - el.scrollTop - el.clientHeight < STICK_SLACK)
        }}
      >
        {shown.map((e) => (
          <div
            key={e.seq}
            className={`baseui:group baseui:grid baseui:grid-cols-[84px_16px_38px_minmax(72px,118px)_1fr] baseui:items-baseline baseui:gap-x-2.5 baseui:px-2.5 baseui:py-px baseui:font-mono baseui:text-[11.5px] baseui:leading-[1.5] ${ROW_TONE[e.level]}`}
          >
            <span className="baseui:tabular-nums baseui:text-muted-foreground baseui:opacity-75">{clockOf(e.ts)}</span>
            <span className={`baseui:text-center baseui:font-semibold ${LEVEL_TONE[e.level]}`}>
              {LEVEL_MARK[e.level]}
            </span>
            <span className="baseui:flex baseui:items-center baseui:gap-1">
              <span
                className={`baseui:h-[5px] baseui:w-[5px] baseui:shrink-0 baseui:rounded-full ${SOURCE_DOT[e.source]}`}
              />
              <span className="baseui:text-muted-foreground baseui:opacity-85">{SOURCE_LABEL[e.source]}</span>
            </span>
            <span
              className="baseui:truncate baseui:text-foreground/70 baseui:group-hover:text-foreground/90"
              title={e.name}
            >
              {e.name}
            </span>
            <span className="baseui:whitespace-pre-wrap baseui:break-all">{e.msg}</span>
          </div>
        ))}

        {shown.length === 0 && (
          <div className="baseui:flex baseui:flex-col baseui:items-center baseui:gap-2.5 baseui:py-14 baseui:text-sm baseui:text-muted-foreground">
            <ScrollText size={26} className="baseui:opacity-25" aria-hidden />
            {/* 空态要区分「一条都没有」和「全被筛掉了」——后者带一个「清筛选」按钮 */}
            {entries.length === 0 ? (
              (failed === '' ? '还没有日志。' : failed)
            ) : (
              <>
                <span>{entries.length} 条都被筛掉了。</span>
                <Button size="sm" variant="secondary" onClick={clearFilter}>
                  清筛选
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {!stick && (
        <button
          type="button"
          onClick={() => setStick(true)}
          className="baseui:absolute baseui:bottom-9 baseui:right-3.5 baseui:z-10 baseui:rounded-full baseui:border baseui:border-border baseui:bg-popover baseui:px-3 baseui:py-1 baseui:text-[11.5px] baseui:text-popover-foreground baseui:shadow-lg baseui:hover:bg-accent"
        >
          已暂停吸附 · 回到底部
        </button>
      )}

      <div className="baseui:flex baseui:items-center baseui:justify-between baseui:gap-3 baseui:border-t baseui:border-border baseui:bg-card baseui:px-2.5 baseui:py-1 baseui:text-[11px] baseui:text-muted-foreground">
        <span>
          {filtering ? `${shown.length} / ${entries.length} 条` : `${entries.length} 条`}
          {entries.length >= CAP ? `（挂满 ${CAP}，更早的去日志文件翻）` : ''}
        </span>
        {where !== null && (
          <span
            className="baseui:truncate baseui:font-mono baseui:text-[10.5px] baseui:opacity-85"
            title={`home：${where.home}`}
          >
            {where.logDir === '' ? where.home : where.logDir}
          </span>
        )}
      </div>
    </div>
  )
}

function boot(args: PaneArgs, container: HTMLElement): Root {
  const root = createRoot(container)
  // 认不出的 paneId 直接报错、不改用 main：「注册了 x 却显示成 main」这种错不会有任何报错提示
  if (args.pane.id === 'logger') root.render(<LoggerPane args={args} />)
  else
    root.render(
      <p className="baseui:p-3 baseui:text-sm baseui:text-destructive">本件没有叫 {args.pane.id} 的窗格</p>,
    )
  return root
}

/**
 * 窗格插件浏览器侧的入口。导出名是 `mountPane` 不是 `bootShell`——外壳占整个页面的根元素，
 * 窗格占窗格容器里的一个窗格，看导出名就知道是哪种插件。
 */
export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const root = boot(args, container)
  return {
    dispose() {
      root.unmount()
      container.textContent = ''
    },
  }
}
