import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import { appendRows, clockOf, LEVELS, SOURCES, type LogLevel, type LogRow, type LogSource } from './entries'
import { countBySource, groupNames, matches, SHOW_EVERYTHING, type FilterState } from './filter'
import { startLogPoller } from './poller'
import { readQueryReply } from './receipts'
import { ScrollText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
 * 日志全部经 `args.host` 调 `logger.query` 拉取，只在所在桌面可见时拉。类名一律带 `baseui:` 前缀，漏加不报错，
 * 由 devkit 的样式检查查出来。本窗格不许调用 `console`：渲染层 console 是日志来源之一，接收路径上打一条
 * 会被写进日志文件、下一次拉取时读回来再打，条数成倍增长、界面卡死
 */

/** 由渲染成本决定；`logger.query` 不给 `limit` 时也回最近 2000 条。更早的去日志文件查 */
const CAP = 2000

/** 可见时两次拉取的间隔 */
const POLL_INTERVAL_MS = 1000

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

const QUERY_COMMAND = 'logger.query'

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
  const [entries, setEntries] = useState<LogRow[]>([])
  /** 最近一次拉取失败的原因。有日志时显示在列表上方，一条都没有时显示在空态里；下一次拉取成功就清掉 */
  const [failed, setFailed] = useState('')
  /** 回执里的 `gwb.log` 路径，第一次拉取成功之前是空串 */
  const [logFile, setLogFile] = useState('')
  const [filter, setFilter] = useState<FilterState>(SHOW_EVERYTHING)
  const [stick, setStick] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poller = startLogPoller({
      fetchPage: async (after) =>
        readQueryReply(await args.host.call(QUERY_COMMAND, after === undefined ? {} : { after })),
      onPage: (page) => {
        setEntries((prev) => appendRows(prev, page.entries, CAP))
        setLogFile(page.file)
        setFailed('')
      },
      onFailure: (reason) => setFailed(`读取日志失败：${reason}`),
      intervalMs: POLL_INTERVAL_MS,
    })
    const offVisibility = args.shell.onVisibility((visible) => poller.setVisible(visible))
    return () => {
      offVisibility()
      poller.stop()
    }
  }, [args.host, args.shell])

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
  const levelVariant = (l: LogLevel): 'default' | 'secondary' | 'ghost' => {
    if (filter.level === l) return 'default'
    return LEVELS.indexOf(l) < LEVELS.indexOf(filter.level) ? 'secondary' : 'ghost'
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
            <Button
              key={l}
              size="xs"
              variant={levelVariant(l)}
              aria-pressed={filter.level === l}
              title={`显示 ${LEVEL_TEXT[l]} 及以上`}
              onClick={() => setFilter((f) => ({ ...f, level: l }))}
            >
              {LEVEL_TEXT[l]}
            </Button>
          ))}
        </div>

        <div className="baseui:ml-1.5 baseui:flex baseui:items-center baseui:gap-1 baseui:border-l baseui:border-border baseui:py-0.5 baseui:pl-2.5">
          {SOURCES.map((s) => {
            const on = filter.sources.has(s)
            return (
              <Button
                key={s}
                size="xs"
                variant={on ? 'secondary' : 'ghost'}
                aria-pressed={on}
                title={`显示或隐藏来自${SOURCE_LABEL[s]}的日志`}
                onClick={() => toggleSource(s)}
              >
                <span className={`baseui:h-1.5 baseui:w-1.5 baseui:rounded-full ${SOURCE_DOT[s]}`} />
                {SOURCE_LABEL[s]}
                <span className="baseui:tabular-nums baseui:opacity-60">{counts[s]}</span>
              </Button>
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

          <div className="baseui:relative baseui:min-w-32 baseui:flex-1">
            <Search
              className="baseui:pointer-events-none baseui:absolute baseui:top-1/2 baseui:left-2 baseui:size-3.5 baseui:-translate-y-1/2 baseui:text-muted-foreground"
              aria-hidden
            />
            <Input
              type="text"
              placeholder="搜索 name 或消息"
              className="baseui:h-8 baseui:pl-7"
              value={filter.search}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="baseui:shrink-0"
            title="只清空这个窗格里显示的日志，日志文件不动。清掉的不会自动回来，重新打开这个窗格才会重新显示"
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
            key={e.rowKey}
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
        <Button
          size="xs"
          variant="outline"
          onClick={() => setStick(true)}
          className="baseui:absolute baseui:right-3.5 baseui:bottom-9 baseui:z-10"
        >
          已暂停自动滚动 · 回到底部
        </Button>
      )}

      <div className="baseui:flex baseui:items-center baseui:justify-between baseui:gap-3 baseui:border-t baseui:border-border baseui:bg-card baseui:px-2.5 baseui:py-1 baseui:text-[11px] baseui:text-muted-foreground">
        <span>
          {filtering ? `${shown.length} / ${entries.length} 条` : `${entries.length} 条`}
          {entries.length >= CAP ? `（已达上限 ${CAP} 条，更早的请查看日志文件）` : ''}
        </span>
        {logFile !== '' && (
          <span className="baseui:truncate baseui:font-mono baseui:text-[10.5px] baseui:opacity-85" title={logFile}>
            {logFile}
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
