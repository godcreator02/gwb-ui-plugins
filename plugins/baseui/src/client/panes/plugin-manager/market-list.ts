import type { MarketStatus } from '@godcreator/gwb-plugin-manager/receipts'
import { SHARED_SECTION, type SettingRow } from './settings'

/**
 * 「可安装」一栏顶上的市场名单：插件管理在设置插件公共区声明的 `plugin-markets`（字符串数组，每项一个 scope）。
 * 窗格用 `settings.all` / `settings.set` 按这个位置读写；每个市场查得怎样看 `plugin-manager.search` 回执的 `markets`
 */

/** 与插件管理 `sources.ts` 的 `MARKETS_SETTING_KEY` 一致 */
export const MARKETS_KEY = 'plugin-markets'

export const MARKETS_SLOT = { section: SHARED_SECTION, key: MARKETS_KEY } as const

/**
 * 公共区里名单那一行 → 现在生效的名单：设过的值，没设过用默认值。
 * 这一行不在、或值不是字符串数组，回 undefined：插件管理没声明它（设置插件或插件管理没加载），界面上说清楚，不当成空名单
 */
export function marketListOf(rows: readonly SettingRow[]): string[] | undefined {
  const row = rows.find((one) => one.section === SHARED_SECTION && one.key === MARKETS_KEY && one.live !== false)
  if (row === undefined) return undefined
  const list = row.value ?? row.default
  if (!Array.isArray(list) || !list.every((one): one is string => typeof one === 'string')) return undefined
  return list
}

/**
 * 要加的 scope 有什么问题，没问题是 undefined。只查空与重复：名单里有重复插件管理会整条拒绝；
 * 写法对不对由插件管理在查的时候按市场报，这里不另写一份规则
 */
export function newMarketProblem(scope: string, current: readonly string[]): string | undefined {
  if (scope === '') return '先填一个 scope，如 @j'
  if (current.includes(scope)) return `${scope} 已经在名单里了`
  return undefined
}

export function withMarket(current: readonly string[], scope: string): string[] {
  return [...current, scope]
}

export function withoutMarket(current: readonly string[], scope: string): string[] {
  return current.filter((one) => one !== scope)
}

/** 市场标签上 scope 后面那几个字 */
export function marketStatusText(status: MarketStatus | undefined): string {
  if (status === undefined) return '还没查'
  if (!status.ok) return '没查成'
  return `${String(status.count ?? 0)} 个`
}
