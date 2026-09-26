import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
// 页面上 `window.gwb` 的类型：内核包包根的全局声明，import 它就生效。实时日志经 `window.gwb.on` 订阅
import type {} from '@godcreator/gwb-kernel-desktop'
import {
  acceptEntries,
  clockOf,
  LEVELS,
  mergeEntries,
  SOURCES,
  type LogEntry,
  type LogLevel,
  type LogSource,
} from './entries'
import { countBySource, groupNames, matches, SHOW_EVERYTHING, type FilterState } from './filter'
import { acceptWhere, asResult, type LogWhere } from './receipts'
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
 * 实时日志订阅页面的 `window.gwb.on`（node 侧 `gwbKernel.emit` 推送、带本插件的标记 `t`），外壳不转发、不认识日志；
 * 历史段与脚注里的路径走 `args.host` 的命令。类名一律带 `baseui:` 前缀，漏加不报错，由 `tests/prefix.test.ts` 检查。
 * 本窗格不许调用 `console`：渲染层 console 是日志来源之一，接收路径上打一条会被推回来再打，条数成倍增长、界面卡死
 */

/** 由渲染成本决定，不是缓冲大小；更早的去日志文件查 */
const CAP = 2000

/** 离底部多少像素以内算作吸附（跟随最新行） */
const STICK_SLACK = 24

/** 「全部来源」那一项的值：Radix 的 SelectItem 不接受空串 */
const ALL_KEY = '*'

const SOURCE_LABEL: Record<LogSource, string> = { plugin: '插件', kernel: '内核', renderer: '页面' }

/** 来源圆点的颜色：插件域令牌 --baseui-src-*（值只在 tokens.css），来源开关与日志行共用 */
const SOURCE_DOT: Record<LogSource, string> = {
  plugin: 'baseui:bg-src-plugin',
  kernel: 'baseui:bg-src-kernel',
  renderer: 'baseui:bg-src-renderer',
}

/** 内核事件里本插件事件的标记，与 node 侧的 EVENT 是同一个字符串 */
const EVENT = 'gwb-logger'
const BACKLOG_COMMAND = 'logger.backlog'
const WHERE_COMMAND = 'logger.where'

const REFETCH_FAILED = '切回这个桌面时补取历史日志失败，切走期间的日志没有显示：'

const LEVEL_MARK: Record<LogLevel, string> = { error: 'E', warn: 'W', info: 'I', debug: 'D' }

const LEVEL_TEXT: Record<LogLevel, string> = { error: 'Error', warn: 'Warn', info: 'Info', debug: 'Debug' }

/** 只有 error/warn 有色：一行里颜色太多就没有重点了 */
const LEVEL_TONE: Record<LogLevel, string> = {
  error: 'baseui:text-destructive',
  warn: 'baseui:text-warning',
  info: 'baseui:text-muted-foreground baseui:opacity-70',
  debug: 'baseui:text-muted-foreground baseui:opacity-40',
}

/** error/warn 淡色底加左边色条（仿 DevTools），其余只有 hover 色 */
const ROW_TONE: Record<LogLevel, string> = {
  error:
    'baseui:bg-destructive/[0.08] baseui:shadow-[inset_2px_0_0_var(--destructive)] baseui:hover:bg-destructive/[0.14]',
  warn: 'baseui:bg-warning/[0.07] baseui:shadow-[inset_2px_0_0_var(--warning)] baseui:hover:bg-warning/[0.12]',
  info: 'baseui:hover:bg-accent',
  debug: 'baseui:hover:bg-accent',
}

function LoggerPane({ args }: { args: PaneArgs }): ReactElement {
  const [entries, setEntries] = useState<LogEntry[]>([])
  /** 取历史段失败的原因。有日志时显示在列表上方，一条都没有时显示在空态里；之后补取成功就清掉 */
  const [failed, setFailed] = useState('')
  const [where, setWhere] = useState<LogWhere | null>(null)
  /** 取不到日志文件位置时脚注少显示路径，改显示原因 */
  const [whereFailed, setWhereFailed] = useState('')
  const [filter, setFilter] = useState<FilterState>(SHOW_EVERYTHING)
  const [stick, setStick] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const take = (batch: unknown): void => {
      if (!alive) return
      // 在更新函数外面收窄：acceptEntries 会抛错，更新函数在渲染时才执行，在那里抛会让整个窗格崩掉
      const accepted = acceptEntries(batch)
      setEntries((prev) => mergeEntries(prev, accepted, CAP))
    }
    // 先订阅、后取历史：反过来会漏掉两者之间推来的条目；交叠部分靠 seq 去重
    const off = window.gwb.on((payload) => {
      if (payload === null || typeof payload !== 'object') return
      const p = payload as { t?: unknown; line?: unknown }
      // 桌面切走时收到的直接丢弃，切回时重取历史段补上
      if (p.t === EVENT && visibleRef.current) take([p.line])
    })
    args.host.call(BACKLOG_COMMAND).then(
      (res) => {
        if (!alive) return
        const r = asResult(res)
        if (!r.ok) {
          setFailed(`读取历史日志失败：${r.error}`)
          return
        }
        try {
          take(r.data)
          setFailed('')
        } catch (err: unknown) {
          setFailed(`读取历史日志失败：${String(err)}`)
        }
      },
      (err: unknown) => {
        if (alive) setFailed(`读取历史日志失败：${String(err)}`)
      },
    )
    return () => {
      alive = false
      off()
    }
  }, [])

  const visibleRef = useRef(true)
  useEffect(() => {
    const off = args.shell.onVisibility((visible) => {
      const wasVisible = visibleRef.current
      visibleRef.current = visible
      // 注册时外壳先回调一次当前值；只有从切走变成切回才补取，挂载时的历史段由上一个 effect 取
      if (!visible || wasVisible) return
      args.host.call(BACKLOG_COMMAND).then(
        (res) => {
          const r = asResult(res)
          if (!r.ok) {
            setFailed(`${REFETCH_FAILED}${r.error}`)
            return
          }
          try {
            const accepted = acceptEntries(r.data)
            setEntries((prev) => mergeEntries(prev, accepted, CAP))
            setFailed('')
          } catch (err: unknown) {
            setFailed(`${REFETCH_FAILED}${String(err)}`)
          }
        },
        (err: unknown) => setFailed(`${REFETCH_FAILED}${String(err)}`),
      )
    })
    return off
  }, [args.host, args.shell])

  useEffect(() => {
    let alive = true
    args.host.call(WHERE_COMMAND).then(
      (res) => {
        if (!alive) return
        const r = asResult(res)
        if (!r.ok) {
          setWhereFailed(`取不到日志文件位置：${r.error}`)
          return
        }
        try {
          setWhere(acceptWhere(r.data))
        } catch (err: unknown) {
          setWhereFailed(`取不到日志文件位置：${String(err)}`)
        }
      },
      (err: unknown) => {
        if (alive) setWhereFailed(`取不到日志文件位置：${String(err)}`)
      },
    )
    return () => {
      alive = false
    }
  }, [args.host])

  const shown = useMemo(() => entries.filter((e) => matches(e, filter)), [entries, filter])
  const counts = useMemo(() => countBySource(entries), [entries])
  const groups = useMemo(() => groupNames(entries), [entries])

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
    setFilter(SHOW_EVERYTHING)
  }

  // 选中的级别实心，更严重的几级浅色高亮，表示显示这一级及以上
  const segTone = (l: LogLevel): string => {
    if (filter.level === l) return 'baseui:bg-primary baseui:text-primary-foreground baseui:font-medium'
    return LEVELS.indexOf(l) < LEVELS.indexOf(filter.level)
      ? 'baseui:bg-accent baseui:text-muted-foreground'
      : 'baseui:text-muted-foreground baseui:hover:text-foreground'
  }

  const filtering =
    filter.level !== SHOW_EVERYTHING.level ||
    filter.sources.size !== SHOW_EVERYTHING.sources.size ||
    filter.key !== SHOW_EVERYTHING.key ||
    filter.search !== SHOW_EVERYTHING.search

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
          {SOURCES.map((s) => {
            const on = filter.sources.has(s)
            return (
              <button
                key={s}
                type="button"
                title={`显示或隐藏来自${SOURCE_LABEL[s]}的日志`}
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
            title="只清空这个窗格里显示的日志，内核的日志缓冲和日志文件都不动。清掉的不会自动回来，重新打开这个窗格才会重新显示"
            onClick={() => setEntries([])}
          >
            清屏
          </Button>
        </div>
      </div>

      {failed !== '' && entries.length > 0 && (
        <div className="baseui:border-b baseui:border-border baseui:bg-destructive/[0.08] baseui:px-2.5 baseui:py-1 baseui:text-[11.5px] baseui:text-destructive">
          {failed}
        </div>
      )}

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
          已暂停自动滚动 · 回到底部
        </button>
      )}

      <div className="baseui:flex baseui:items-center baseui:justify-between baseui:gap-3 baseui:border-t baseui:border-border baseui:bg-card baseui:px-2.5 baseui:py-1 baseui:text-[11px] baseui:text-muted-foreground">
        <span>
          {filtering ? `${shown.length} / ${entries.length} 条` : `${entries.length} 条`}
          {entries.length >= CAP ? `（已达上限 ${CAP} 条，更早的请查看日志文件）` : ''}
        </span>
        {where !== null && (
          <span
            className="baseui:truncate baseui:font-mono baseui:text-[10.5px] baseui:opacity-85"
            title={`home：${where.home}`}
          >
            {where.logFile}
          </span>
        )}
        {whereFailed !== '' && (
          <span className="baseui:truncate baseui:text-destructive" title={whereFailed}>
            {whereFailed}
          </span>
        )}
      </div>
    </div>
  )
}

function boot(args: PaneArgs, container: HTMLElement): Root {
  const root = createRoot(container)
  root.render(<LoggerPane args={args} />)
  return root
}

export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const root = boot(args, container)
  return {
    dispose() {
      root.unmount()
      container.textContent = ''
    },
  }
}
