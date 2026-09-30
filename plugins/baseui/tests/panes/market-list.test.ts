import { describe, expect, it } from 'vitest'
import { marketListOf, marketStatusText, newMarketProblem, withMarket, withoutMarket } from '../../src/client/panes/plugin-manager/market-list'
import type { SettingRow } from '../../src/client/panes/plugin-manager/settings'

/** 「可安装」一栏顶上的市场名单：读的是 `settings.all {section:"*"}` 收窄后的行，写回的是整份数组 */

const marketsRow = (patch: Partial<SettingRow> = {}): SettingRow => ({
  section: '*',
  key: 'plugin-markets',
  type: 'string-list',
  default: ['@godcreator'],
  ...patch,
})

describe('marketListOf：现在生效的名单', () => {
  it('没设过用默认值，设过用设的值', () => {
    expect(marketListOf([marketsRow()])).toEqual(['@godcreator'])
    expect(marketListOf([marketsRow({ value: ['@godcreator', '@j'] })])).toEqual(['@godcreator', '@j'])
  })

  it('这一行不在、没人声明、值不是字符串数组：undefined，不当成空名单', () => {
    expect(marketListOf([])).toBeUndefined()
    expect(marketListOf([marketsRow({ live: false })])).toBeUndefined()
    expect(marketListOf([marketsRow({ value: '@j' })])).toBeUndefined()
    expect(marketListOf([marketsRow({ section: 'plugin-manager' })])).toBeUndefined()
  })

  it('设成空数组就是空名单（插件管理检索时会说名单是空的）', () => {
    expect(marketListOf([marketsRow({ value: [] })])).toEqual([])
  })
})

describe('加删市场', () => {
  it('空的、已经在名单里的不加，说出原因', () => {
    expect(newMarketProblem('', ['@godcreator'])).toContain('先填一个 scope')
    expect(newMarketProblem('@godcreator', ['@godcreator'])).toContain('已经在名单里了')
    expect(newMarketProblem('@j', ['@godcreator'])).toBeUndefined()
  })

  it('加在末尾、删掉那一项，别的顺序不变', () => {
    expect(withMarket(['@godcreator'], '@j')).toEqual(['@godcreator', '@j'])
    expect(withoutMarket(['@godcreator', '@j', '@k'], '@j')).toEqual(['@godcreator', '@k'])
  })
})

describe('marketStatusText：标签上 scope 后面那几个字', () => {
  it('查成了写几个，没查成、还没查分开说', () => {
    expect(marketStatusText({ scope: '@j', ok: true, count: 3 })).toBe('3 个')
    expect(marketStatusText({ scope: '@nope', ok: false, error: '没配源' })).toBe('没查成')
    expect(marketStatusText(undefined)).toBe('还没查')
  })
})
