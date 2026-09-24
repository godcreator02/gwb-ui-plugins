import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { RotateCw, Search } from 'lucide-react'
import { asResult } from './rows'
import { acceptNote, acceptPackages, scopeOf, scopeOptions, NO_INDEX, summarize, toRows, type InstalledIndex, type SearchRow } from './market-rows'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * 「可装」一栏：不带参数调一次 `plugin-manager.search` 拿回全部源的结果，搜索框只在本地筛选；registry 地址由插件管理按 scope 从 npmrc 找。
 * 已装的不给「再装一份」按钮：多数插件提供服务，第二条条目会报 `service ... has been registered`，要第二条去「已装」一栏用 add-entry
 */

const SEARCH = 'plugin-manager.search'
const INSTALL = 'plugin-manager.install'

/** 源下拉里「不筛」那一项：radix 的 SelectItem 不接受空串 value */
const ALL_SOURCES = 'all'

/** host 只按用到的形状声明 */
export interface MarketTabProps {
  host: { call: (command: string, args?: unknown) => Promise<unknown> }
  /** 已装的包 → 版本范围；null 表示表还没取到，那时装没装一概不显示 */
  installed: InstalledIndex | null
  /** 父窗格在做别的操作时，整栏禁用 */
  busy: boolean
  /** 装成后通知父窗格重新取表：没有事件推送，不重新取的话「已装」一栏停在旧的样子 */
  onChanged: () => Promise<void> | void
  /** radix 弹出层的挂载点（本窗格所在桌面的 args.shell.portal） */
  portal: HTMLElement
}

export function MarketTab({ host, installed, busy, onChanged, portal }: MarketTabProps): ReactElement {
  const [query, setQuery] = useState('')
  /** ALL_SOURCES 表示不按源筛 */
  const [source, setSource] = useState(ALL_SOURCES)
  /** null 是还没查到，与查到了但一个都没有（空数组）分开 */
  const [rows, setRows] = useState<SearchRow[] | null>(null)
  /** 哪几条源没查成；空串表示都查成了 */
  const [sourceNote, setSourceNote] = useState('')
  /** 检索本身失败的原因，与按包名显示在行上的安装失败分开 */
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  /** 正在安装的包名，空串表示没在安装；安装要几秒到几十秒，期间整栏禁用 */
  const [busyPkg, setBusyPkg] = useState('')
  /** 安装失败的原话，按包名存，在那一行显示全文（pnpm 输出的最后几行在里面） */
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [done, setDone] = useState('')

  /** 命令回执里还包着一层 search 自己的 ok/error，两层的错误都要显示；筛选不在这里做 */
  const searchNow = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = asResult(await host.call(SEARCH))
      if (!result.ok) {
        setRows(null)
        setSourceNote('')
        setLoadError(result.error ?? '')
        return
      }
      const receipt = typeof result.data === 'object' && result.data !== null ? result.data : {}
      const innerOk = (receipt as Record<string, unknown>)['ok'] === true
      if (!innerOk) {
        setRows(null)
        setSourceNote('')
        setLoadError(
          typeof (receipt as Record<string, unknown>)['error'] === 'string'
            ? String((receipt as Record<string, unknown>)['error'])
            : '检索没成，也没说是为什么',
        )
        return
      }
      setRows(acceptPackages((receipt as Record<string, unknown>)['packages']))
      setSourceNote(acceptNote((receipt as Record<string, unknown>)['note']))
      setLoadError('')
    } catch (err: unknown) {
      setRows(null)
      setSourceNote('')
      setLoadError(String(err))
    } finally {
      setLoading(false)
    }
  }, [host])

  useEffect(() => {
    void searchNow()
  }, [searchNow])

  /** 装完一定通知父窗格重新取表，否则这一行一直显示「装」，看起来就是点了没反应 */
  const install = async (pkg: string): Promise<void> => {
    setBusyPkg(pkg)
    setDone('')
    setFailed((prev) => {
      const next = { ...prev }
      delete next[pkg]
      return next
    })
    try {
      const result = asResult(await host.call(INSTALL, { pkg }))
      if (result.ok) {
        setDone(`${pkg} 装上了，条目也加进 cordis.yml 了。加载成功没有，去「已装」那一栏看。`)
        await onChanged()
      }
      // error 里带着 pnpm 输出的最后几行，一个字都不能丢
      else setFailed((prev) => ({ ...prev, [pkg]: result.error ?? '' }))
    } catch (err: unknown) {
      setFailed((prev) => ({ ...prev, [pkg]: String(err) }))
    }
    setBusyPkg('')
  }

  /** 表还没取到时只读 */
  const readOnly = installed === null
  const index = installed ?? NO_INDEX
  const scopes = useMemo(() => scopeOptions(rows ?? []), [rows])
  /** 选中的源在重新检索后没了就当作不筛，别留一个选不回去的值 */
  const active = source === ALL_SOURCES || scopes.some((one) => one.scope === source) ? source : ALL_SOURCES
  const shown = useMemo(() => toRows(rows ?? [], index, query, active === ALL_SOURCES ? '' : active), [rows, index, query, active])
  const summary = useMemo(() => summarize(rows ?? [], index, shown), [rows, index, shown])
  const working = busyPkg !== '' || busy

  return (
    <div className="baseui:flex baseui:h-full baseui:flex-col">
      <div className="baseui:flex baseui:flex-wrap baseui:items-center baseui:gap-2 baseui:border-b baseui:border-border baseui:px-3 baseui:py-2">
        <div className="baseui:relative baseui:min-w-40 baseui:flex-1">
          <Search className="baseui:pointer-events-none baseui:absolute baseui:top-1/2 baseui:left-2 baseui:size-3.5 baseui:-translate-y-1/2 baseui:text-muted-foreground" />
          <Input
            type="search"
            className="baseui:h-8 baseui:pl-7"
            placeholder="筛全部源，如 log、theme"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={active} onValueChange={setSource}>
          <SelectTrigger size="sm" className="baseui:h-8" title="按源筛，与搜索框叠加">
            <SelectValue />
          </SelectTrigger>
          <SelectContent container={portal}>
            <SelectItem value={ALL_SOURCES}>全部源</SelectItem>
            {scopes.map((one) => (
              <SelectItem key={one.scope} value={one.scope}>{`${one.scope} (${String(one.count)})`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="baseui:shrink-0 baseui:text-xs baseui:text-muted-foreground">
          {rows === null
            ? '查 registry…'
            : `${String(summary.total)} 个 gwb 插件 · 已装 ${String(summary.installed)}${
                query.trim() === '' && active === ALL_SOURCES
                  ? ''
                  : ` · 筛出 ${String(summary.shown)}`
              }`}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          title="重新查一遍 registry"
          disabled={loading || working}
          onClick={() => void searchNow()}
        >
          <RotateCw />
        </Button>
      </div>

      {sourceNote !== '' && (
        <div className="baseui:border-b baseui:border-border baseui:px-3 baseui:py-2 baseui:text-xs baseui:text-muted-foreground">
          {sourceNote}
        </div>
      )}

      {done !== '' && (
        <div className="baseui:flex baseui:items-start baseui:gap-2 baseui:border-b baseui:border-border baseui:px-3 baseui:py-2 baseui:text-xs baseui:text-muted-foreground">
          <span className="baseui:flex-1 baseui:whitespace-pre-wrap baseui:break-all">{done}</span>
          <Button size="xs" variant="ghost" onClick={() => setDone('')}>
            知道了
          </Button>
        </div>
      )}

      {loadError !== '' && (
        <div className="baseui:border-b baseui:border-border baseui:px-3 baseui:py-2">
          <p className="baseui:text-sm baseui:text-destructive">查不到 registry，下面空着不代表没有插件。</p>
          <p className="baseui:mt-1 baseui:whitespace-pre-wrap baseui:break-all baseui:text-xs baseui:text-destructive">{loadError}</p>
          <p className="baseui:mt-1 baseui:text-xs baseui:text-muted-foreground">
            搜索由插件管理的 plugin-manager.search 提供；插件管理版本太旧、还没有这条命令时这里查不到，先在「已装」那一栏把 @godcreator/gwb-plugin-manager 更新到最新版。
          </p>
        </div>
      )}

      <div className="baseui:flex-1 baseui:overflow-auto">
        {rows !== null && shown.length === 0 && (
          <p className="baseui:p-6 baseui:text-sm baseui:text-muted-foreground">
            {query.trim() === '' && active === ALL_SOURCES
              ? '配好的源上一个 gwb 插件都没有。'
              : `配好的源里没有同时满足「${[active === ALL_SOURCES ? null : active, query.trim() === '' ? null : query.trim()].filter((part): part is string => part !== null).join('」+「')}」这两个筛选条件的（共 ${String(summary.total)} 个）。放宽一个条件试试；列表里没有的包名，用顶部的「直接装包名」。`}
          </p>
        )}

        {shown.map((row) => (
          <div key={row.pkg} className="baseui:border-b baseui:border-border baseui:px-3 baseui:py-2">
            <div className="baseui:flex baseui:items-baseline baseui:gap-2">
              <span className="baseui:font-mono baseui:text-sm baseui:break-all">{row.pkg}</span>
              {scopeOf(row.pkg) !== '' && scopeOf(row.pkg) !== '@godcreator' && (
                // @godcreator 的不显示标签，满屏标签只会干扰
                <Badge
                  variant="outline"
                  className="baseui:shrink-0"
                  title="第三方源上的插件（这个 scope 是用 plugin-manager.source.add 配的）"
                >
                  {scopeOf(row.pkg)}
                </Badge>
              )}
              {row.version !== undefined && (
                <span className="baseui:shrink-0 baseui:font-mono baseui:text-xs baseui:text-muted-foreground" title="registry 上的最新版">
                  {row.version}
                </span>
              )}
              <span className="baseui:flex-1" />

              {readOnly ? null : row.installed ? (
                // 已装的不给「再装一份」按钮，理由见文件头
                <span className="baseui:flex baseui:items-baseline baseui:gap-2">
                  {row.spec !== undefined && <span className="baseui:font-mono baseui:text-xs baseui:text-muted-foreground">{row.spec}</span>}
                  <Badge
                    variant="outline"
                    className="baseui:opacity-60"
                    title="这个包已经在 home 里了。要给它多加一条条目，去「已装」那一栏用 plugin-manager.add-entry"
                  >
                    已装
                  </Badge>
                </span>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={working}
                  title="pnpm add 进 home，再自动加一条 cordis.yml 条目。装的是最新版"
                  onClick={() => void install(row.pkg)}
                >
                  {busyPkg === row.pkg ? '装着…' : '装'}
                </Button>
              )}
            </div>

            {row.description !== undefined && (
              <p className="baseui:mt-0.5 baseui:text-xs baseui:text-muted-foreground">{row.description}</p>
            )}

            {/* 显示全文：pnpm 输出的最后几行在里面 */}
            {failed[row.pkg] !== undefined && (
              <pre className="baseui:mt-1 baseui:rounded-md baseui:bg-destructive/10 baseui:p-2 baseui:text-xs baseui:whitespace-pre-wrap baseui:break-all baseui:text-destructive">
                {failed[row.pkg]}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
