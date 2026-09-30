import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Plus, RotateCw, Search, X } from 'lucide-react'
import type { MarketStatus, PluginRow } from '@godcreator/gwb-plugin-manager/receipts'
import { callPluginManager, type CommandHost } from './receipts'
import { scopeOf, scopeOptions, NO_INDEX, summarize, toRows, type InstalledIndex } from './market-rows'
import { marketListOf, MARKETS_SLOT, marketStatusText, newMarketProblem, withMarket, withoutMarket } from './market-list'
import { asResult } from './rows'
import { acceptSettings } from './settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * 「可安装」一栏：不带参数调一次 `plugin-manager.search` 拿回市场名单里全部市场的结果，搜索框只在本地筛选；
 * 每个市场的源地址由插件管理问 pnpm。顶上一行是市场名单，按设置插件公共区的位置读写（`market-list.ts`），改完重新检索。
 * 已装的不给「再装一份」按钮：多数插件提供服务，第二条条目会报 `service ... has been registered`，要第二条去「已安装」一栏用 add-entry
 */

const SEARCH = 'plugin-manager.search'
const INSTALL = 'plugin-manager.install'
const SETTINGS_ALL = 'settings.all'
const SETTINGS_SET = 'settings.set'

/** 源下拉里「不筛」那一项：radix 的 SelectItem 不接受空串 value */
const ALL_SOURCES = 'all'

export interface MarketTabProps {
  host: CommandHost
  /** 已装的包 → 版本范围；null 表示表还没取到，那时装没装一概不显示 */
  installed: InstalledIndex | null
  /** 父窗格在做别的操作时，整栏禁用 */
  busy: boolean
  /** 装成后通知父窗格重新取表：没有事件推送，不重新取的话「已安装」一栏停在旧的样子 */
  onChanged: () => Promise<void> | void
  /** radix 弹出层的挂载点（本窗格所在桌面的 args.shell.portal） */
  portal: HTMLElement
}

export function MarketTab({ host, installed, busy, onChanged, portal }: MarketTabProps): ReactElement {
  const [query, setQuery] = useState('')
  /** ALL_SOURCES 表示不按源筛 */
  const [source, setSource] = useState(ALL_SOURCES)
  /** null 是还没查到，与查到了但一个都没有（空数组）分开 */
  const [rows, setRows] = useState<PluginRow[] | null>(null)
  /** 上一次检索里每个市场查得怎样；检索整个失败时是空数组，原因在 loadError */
  const [statuses, setStatuses] = useState<MarketStatus[]>([])
  /** 检索本身失败的原因，与按包名显示在行上的安装失败分开 */
  const [loadError, setLoadError] = useState('')
  /** 现在生效的市场名单；null 是还没读到或读不到（原因在 marketsError） */
  const [markets, setMarkets] = useState<string[] | null>(null)
  const [marketsError, setMarketsError] = useState('')
  /** 输入框里要加的 scope */
  const [newMarket, setNewMarket] = useState('')
  /** 正在写名单 */
  const [savingMarkets, setSavingMarkets] = useState(false)
  const [loading, setLoading] = useState(false)
  /** 正在安装的包名，空串表示没在安装；安装要几秒到几十秒，期间整栏禁用 */
  const [busyPkg, setBusyPkg] = useState('')
  /** 安装失败的原话，按包名存，在那一行显示全文（pnpm 输出的最后几行在里面） */
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [done, setDone] = useState('')

  /** 筛选不在这里做 */
  const searchNow = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await callPluginManager(host, SEARCH)
      if (!result.ok) {
        setRows(null)
        setStatuses([])
        setLoadError(result.error)
        return
      }
      setRows(result.data.packages)
      setStatuses(result.data.markets)
      setLoadError('')
    } catch (err: unknown) {
      setRows(null)
      setStatuses([])
      setLoadError(String(err))
    } finally {
      setLoading(false)
    }
  }, [host])

  /** 名单读不到时不当成空名单：插件管理或设置插件没加载，说出来 */
  const loadMarkets = useCallback(async (): Promise<void> => {
    try {
      const result = asResult(await host.call(SETTINGS_ALL, { section: MARKETS_SLOT.section }))
      if (!result.ok) {
        setMarkets(null)
        setMarketsError(result.error)
        return
      }
      const list = marketListOf(acceptSettings(result.data))
      setMarkets(list ?? null)
      setMarketsError(list === undefined ? `设置插件公共区里没有 ${MARKETS_SLOT.key} 这一项：插件管理没声明它（设置插件或插件管理没加载）` : '')
    } catch (err: unknown) {
      setMarkets(null)
      setMarketsError(String(err))
    }
  }, [host])

  useEffect(() => {
    void searchNow()
    void loadMarkets()
  }, [searchNow, loadMarkets])

  /** 整份名单写回再重新检索；「已安装」一栏的公共区设置也跟着变，所以同样通知父窗格重新取 */
  const saveMarkets = async (next: string[]): Promise<void> => {
    setSavingMarkets(true)
    try {
      const result = asResult(await host.call(SETTINGS_SET, { ...MARKETS_SLOT, value: next }))
      if (!result.ok) {
        setMarketsError(`名单没存上：${result.error}`)
        return
      }
      setMarkets(next)
      setMarketsError('')
      setNewMarket('')
      await searchNow()
      await onChanged()
    } catch (err: unknown) {
      setMarketsError(`名单没存上：${String(err)}`)
    } finally {
      setSavingMarkets(false)
    }
  }

  const addMarket = (): void => {
    if (markets === null) return
    const scope = newMarket.trim()
    const problem = newMarketProblem(scope, markets)
    if (problem !== undefined) {
      setMarketsError(problem)
      return
    }
    void saveMarkets(withMarket(markets, scope))
  }

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
      const result = await callPluginManager(host, INSTALL, { pkg })
      if (result.ok) {
        setDone(`${pkg} 已安装，条目也已加入 cordis.yml。是否加载成功，到「已安装」那一栏查看。`)
        await onChanged()
      }
      // error 里带着 pnpm 输出的最后几行，一个字都不能丢
      else setFailed((prev) => ({ ...prev, [pkg]: result.error }))
    } catch (err: unknown) {
      setFailed((prev) => ({ ...prev, [pkg]: String(err) }))
    }
    setBusyPkg('')
  }

  const readOnly = installed === null
  const index = installed ?? NO_INDEX
  const scopes = useMemo(() => scopeOptions(rows ?? []), [rows])
  /** 选中的源在重新检索后没了就当作不筛，别留一个选不回去的值 */
  const active = source === ALL_SOURCES || scopes.some((one) => one.scope === source) ? source : ALL_SOURCES
  const shown = useMemo(() => toRows(rows ?? [], index, query, active === ALL_SOURCES ? '' : active), [rows, index, query, active])
  const summary = useMemo(() => summarize(rows ?? [], index, shown), [rows, index, shown])
  const working = busyPkg !== '' || busy || savingMarkets
  const failedMarkets = statuses.filter((status) => !status.ok)

  return (
    <div className="baseui:flex baseui:h-full baseui:flex-col">
      <div className="baseui:flex baseui:flex-wrap baseui:items-center baseui:gap-2 baseui:border-b baseui:border-border baseui:px-3 baseui:py-2">
        <div className="baseui:relative baseui:min-w-40 baseui:flex-1">
          <Search className="baseui:pointer-events-none baseui:absolute baseui:top-1/2 baseui:left-2 baseui:size-3.5 baseui:-translate-y-1/2 baseui:text-muted-foreground" />
          <Input
            type="search"
            className="baseui:h-8 baseui:pl-7"
            placeholder="在全部市场里筛选，如 log、theme"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={active} onValueChange={setSource}>
          <SelectTrigger size="sm" className="baseui:h-8" title="按市场筛，与搜索框叠加">
            <SelectValue />
          </SelectTrigger>
          <SelectContent container={portal}>
            <SelectItem value={ALL_SOURCES}>全部市场</SelectItem>
            {scopes.map((one) => (
              <SelectItem key={one.scope} value={one.scope}>{`${one.scope} (${String(one.count)})`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="baseui:shrink-0 baseui:text-xs baseui:text-muted-foreground">
          {rows === null
            ? '正在查询 registry…'
            : `${String(summary.total)} 个 gwb 插件 · 已安装 ${String(summary.installed)}${
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

      <div className="baseui:flex baseui:flex-wrap baseui:items-center baseui:gap-1.5 baseui:border-b baseui:border-border baseui:px-3 baseui:py-2">
        <span
          className="baseui:shrink-0 baseui:text-xs baseui:text-muted-foreground"
          title="只在这些 scope 上找插件。每个市场的源地址按 pnpm 的配置走（~/.npmrc 里的 @<scope>:registry=…），装包也从那里装；名单存在设置插件公共区的 plugin-markets"
        >
          市场
        </span>
        {(markets ?? []).map((scope) => {
          const status = statuses.find((one) => one.scope === scope)
          return (
            <Badge
              key={scope}
              variant="outline"
              className={`baseui:gap-1 baseui:font-mono ${status !== undefined && !status.ok ? 'baseui:border-destructive baseui:text-destructive' : ''}`}
              title={status?.registry ?? status?.error ?? '这次检索还没查它'}
            >
              {scope}
              <span className="baseui:text-muted-foreground">{marketStatusText(status)}</span>
              <button
                type="button"
                className="baseui:ml-0.5 baseui:rounded-sm baseui:opacity-60 baseui:hover:opacity-100 baseui:disabled:opacity-30"
                title={`从名单里去掉 ${scope}（~/.npmrc 里它的源不动）`}
                disabled={working}
                onClick={() => void saveMarkets(withoutMarket(markets ?? [], scope))}
              >
                <X className="baseui:size-3" />
              </button>
            </Badge>
          )
        })}
        {markets !== null && (
          <form
            className="baseui:flex baseui:items-center baseui:gap-1"
            onSubmit={(event) => {
              event.preventDefault()
              addMarket()
            }}
          >
            <Input
              className="baseui:h-6 baseui:w-28 baseui:font-mono baseui:text-xs"
              placeholder="@scope"
              value={newMarket}
              onChange={(event) => setNewMarket(event.target.value)}
            />
            <Button
              type="submit"
              size="xs"
              variant="ghost"
              disabled={working}
              title="加进名单再重新检索。私有源还要照说明书 gwb-plugin-manager 的「加一个市场」往 ~/.npmrc 写源与凭据"
            >
              <Plus />
              加市场
            </Button>
          </form>
        )}
      </div>

      {(marketsError !== '' || failedMarkets.length > 0) && (
        <div className="baseui:border-b baseui:border-border baseui:px-3 baseui:py-2 baseui:text-xs baseui:text-destructive">
          {marketsError !== '' && <p className="baseui:whitespace-pre-wrap baseui:break-all">{marketsError}</p>}
          {failedMarkets.map((status) => (
            <p key={status.scope} className="baseui:whitespace-pre-wrap baseui:break-all">{`${status.scope}：${status.error ?? '没说原因'}`}</p>
          ))}
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
        </div>
      )}

      <div className="baseui:flex-1 baseui:overflow-auto">
        {rows !== null && shown.length === 0 && (
          <p className="baseui:p-6 baseui:text-sm baseui:text-muted-foreground">
            {query.trim() === '' && active === ALL_SOURCES
              ? '名单里的市场上一个 gwb 插件都没有。'
              : `名单里的市场上没有同时满足「${[active === ALL_SOURCES ? null : active, query.trim() === '' ? null : query.trim()].filter((part): part is string => part !== null).join('」+「')}」这两个筛选条件的（共 ${String(summary.total)} 个）。放宽一个条件试试；列表里没有的包名，用顶部的「按包名直接安装」。`}
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
                  title="第三方市场上的插件（这个市场的源写在 ~/.npmrc 里，怎么加见说明书 gwb-plugin-manager 的「加一个市场」）"
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
                    title="这个包已经在 home 里了。要给它多加一条条目，去「已安装」那一栏用 plugin-manager.add-entry"
                  >
                    已安装
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
                  {busyPkg === row.pkg ? '安装中…' : '安装'}
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
