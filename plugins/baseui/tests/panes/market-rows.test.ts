import { describe, expect, it } from 'vitest'
import { acceptNote, acceptPackages, installedIndex, matchesQuery, NO_INDEX, scopeOf, scopeOptions, summarize, toRows, type SearchRow } from '../../src/client/panes/plugin-manager/market-rows'

/**
 * 「可装」那一栏的纯逻辑。筛选的是 **registry 检索结果**——`plugin-manager.search`
 * 一次取回全部结果，搜索框只在本地筛选。acceptPackages 的形状检查也在这一组里。
 * 检索**合并多条源**（@godcreator 加上 ~/.npmrc 里配的第三方源），每行的来源标签与
 * 检索回执 note 的处理（scopeOf / acceptNote）也在这一组测。
 */

const row = (pkg: string, patch: Partial<SearchRow> = {}): SearchRow => ({
  pkg,
  version: '0.0.1',
  description: `${pkg} 的一句话`,
  ...patch,
})

/** `plugin-manager.list` 已取的包行 → 索引。只收 installed === true 的 */
const index = (...pkgs: { pkg: string; installed: boolean; spec?: string }[]) => installedIndex(pkgs)
const installed = (pkg: string, spec?: string) => ({ pkg, installed: true, spec })

describe('acceptPackages：plugin-manager.search 的 data 收窄', () => {
  it('一份正经的表原样收下', () => {
    expect(acceptPackages([{ pkg: 'a', version: '0.0.2', description: '甲' }])).toEqual([
      { pkg: 'a', version: '0.0.2', description: '甲' },
    ])
  })

  it('不是数组、不是对象、没有 pkg 的都丢掉，不崩', () => {
    expect(acceptPackages(undefined)).toEqual([])
    expect(acceptPackages({ pkg: 'x' })).toEqual([])
    expect(acceptPackages([null, 7, { pkg: '' }, { pkg: 'a' }])).toEqual([{ pkg: 'a' }])
  })

  it('version / description 不是非空字符串就当没有', () => {
    expect(acceptPackages([{ pkg: 'a', version: '', description: 7 }])).toEqual([{ pkg: 'a' }])
  })
})

describe('scopeOf：行上源徽章的判据', () => {
  it('带 scope 的包名剥出 scope，第三方与官方都剥得出', () => {
    expect(scopeOf('@j/gwb-daily-planner')).toBe('@j')
    expect(scopeOf('@godcreator/gwb-shell')).toBe('@godcreator')
  })

  it('裸名、只有 @、@ 后没有 / 的都回空串（不猜）', () => {
    expect(scopeOf('gwb-shell')).toBe('')
    expect(scopeOf('@')).toBe('')
    expect(scopeOf('@joke')).toBe('')
  })
})

describe('scopeOptions：源筛选项从已加载的行现推', () => {
  it('按首次出现次序列、带计数——聚合回执本来就官方线在前，不另排', () => {
    const rows = [
      row('@godcreator/gwb-shell'),
      row('@godcreator/gwb-theme'),
      row('@god-private/gwb-cgm-alert'),
      row('@godcreator/gwb-devkit'),
      row('@j/gwb-daily-planner'),
    ]
    expect(scopeOptions(rows)).toEqual([
      { scope: '@godcreator', count: 3 },
      { scope: '@god-private', count: 1 },
      { scope: '@j', count: 1 },
    ])
  })

  it('裸名包不进筛选项；一条没有回空数组（下拉里只剩「全部源」）', () => {
    expect(scopeOptions([row('plain-pkg'), row('@a/x')])).toEqual([{ scope: '@a', count: 1 }])
    expect(scopeOptions([row('plain-pkg')])).toEqual([])
    expect(scopeOptions([])).toEqual([])
  })
})

describe('toRows 的源筛：与文本筛 AND 叠加', () => {
  const packages = [
    row('@godcreator/gwb-shell', { description: '外壳' }),
    row('@godcreator/gwb-theme', { description: '外观' }),
    row('@j/gwb-daily-planner', { description: '每日计划' }),
  ]

  it('选了源只留那条线，顺序照检索结果', () => {
    expect(toRows(packages, NO_INDEX, '', '@j').map((one) => one.pkg)).toEqual(['@j/gwb-daily-planner'])
    expect(toRows(packages, NO_INDEX, '', '@godcreator').map((one) => one.pkg)).toEqual([
      '@godcreator/gwb-shell',
      '@godcreator/gwb-theme',
    ])
  })

  it('源筛与文本筛一起收：交集；选了不存在的源回空（界面层保证不出现这种选项）', () => {
    expect(toRows(packages, NO_INDEX, 'theme', '@godcreator').map((one) => one.pkg)).toEqual(['@godcreator/gwb-theme'])
    expect(toRows(packages, NO_INDEX, '每日', '@j').map((one) => one.pkg)).toEqual(['@j/gwb-daily-planner'])
    expect(toRows(packages, NO_INDEX, 'theme', '@j')).toEqual([])
    expect(toRows(packages, NO_INDEX, '', '@nope')).toEqual([])
  })

  it('scope 缺省（空串）＝不筛，老行为原样', () => {
    expect(toRows(packages, NO_INDEX, '')).toHaveLength(3)
  })
})

describe('acceptNote：聚合回执里「哪几条源没查成」的收窄', () => {
  it('字符串原样过，没有这个字段回空串', () => {
    expect(acceptNote('这几条源没查成：@x')).toBe('这几条源没查成：@x')
    expect(acceptNote(undefined)).toBe('')
  })

  it('**不是字符串就说形状不对**：当成没有会把「哪几条源没查成」藏起来', () => {
    expect(acceptNote(7)).toContain('形状不对')
    expect(acceptNote(['@x'])).toContain('形状不对')
  })
})

describe('已装索引：从窗格已取的那份表推导', () => {
  it('installed 是 true 的收下（spec 有则带），不是 true 的一概当没装', () => {
    const got = installedIndex([
      { pkg: 'a', installed: true, spec: '^0.0.2' },
      { pkg: 'b', installed: false, spec: '^0.0.1' },
    ])
    expect(got.get('a')).toBe('^0.0.2')
    expect(got.has('b')).toBe(false)
  })

  it('装了但没版本范围的，用 undefined 占位——**在表里**跟不在表里是两回事', () => {
    const got = installedIndex([{ pkg: 'a', installed: true }])
    expect(got.has('a')).toBe(true)
    expect(got.get('a')).toBeUndefined()
  })
})

describe('搜索框：检索结果的本地筛，包名与那句话一起筛', () => {
  it('空串（和只有空白的）不筛，全过', () => {
    expect(matchesQuery(row('a'), '')).toBe(true)
    expect(matchesQuery(row('a'), '   ')).toBe(true)
  })

  it('包名、描述两处都能命中，不区分大小写', () => {
    expect(matchesQuery(row('@godcreator/gwb-logger'), 'logger')).toBe(true)
    expect(matchesQuery(row('a', { description: '脱离终端查日志' }), '日志')).toBe(true)
    expect(matchesQuery(row('a'), '  A  ')).toBe(true)
  })

  it('没描述的行只拿包名筛，匹配不上就是匹配不上', () => {
    expect(matchesQuery({ pkg: 'a' }, 'b')).toBe(false)
  })
})

describe('对账：检索结果 + 已装的那份 → 要画的行', () => {
  const catalog = [row('a'), row('b')]

  it('装了的带 installed 与版本范围，没装的不带', () => {
    const rows = toRows(catalog, index(installed('a', '^0.0.3')), '')
    expect(rows[0]).toMatchObject({ pkg: 'a', installed: true, spec: '^0.0.3' })
    expect(rows[1]!.installed).toBe(false)
    expect(rows[1]!.spec).toBeUndefined()
  })

  it('装了但没版本号：照样是「已装」', () => {
    expect(toRows(catalog, index(installed('a')), '')[0]).toEqual({ ...catalog[0], installed: true })
  })

  it('**顺序照检索结果**，装没装不参与排序——列表跳来跳去人会找不到刚才那一行', () => {
    expect(toRows(catalog, index(installed('b')), '').map((r) => r.pkg)).toEqual(['a', 'b'])
  })

  it('home 里多出来的包不摆进这段——它只认检索结果', () => {
    const rows = toRows(catalog, index(installed('@godcreator/gwb-api')), '')
    expect(rows.map((r) => r.pkg)).toEqual(['a', 'b'])
  })

  it('筛了之后只剩匹配的那几行', () => {
    expect(toRows(catalog, NO_INDEX, 'b').map((r) => r.pkg)).toEqual(['b'])
  })
})

describe('汇总', () => {
  const catalog = [row('a'), row('b'), row('c')]

  it('**已装的数量数的是筛选之前的全量**，筛出来几行单独一个字段', () => {
    const idx = index(installed('a'), installed('c'))
    expect(summarize(catalog, idx, toRows(catalog, idx, 'b'))).toEqual({ total: 3, installed: 2, shown: 1 })
  })

  it('一个都没装时是 0，不是空', () => {
    expect(summarize(catalog, NO_INDEX, toRows(catalog, NO_INDEX, ''))).toEqual({ total: 3, installed: 0, shown: 3 })
  })
})
