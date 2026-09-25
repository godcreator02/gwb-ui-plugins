import { describe, expect, it } from 'vitest'
import {
  acceptPackages,
  asResult,
  kernelTestMark,
  stateOf,
  summarize,
  toRows,
  type EntryView,
  type PackageView,
} from '../../src/client/panes/plugin-manager/rows'

const entry = (patch: Partial<EntryView> = {}): EntryView => ({
  id: 'data',
  entryId: 'home:data',
  pkg: '@godcreator/gwb-data',
  disabled: false,
  active: true,
  group: false,
  ...patch,
})

const pkg = (patch: Partial<PackageView> = {}): PackageView => ({
  pkg: '@godcreator/gwb-data',
  spec: '0.0.2',
  installed: true,
  entries: [entry()],
  kernelUntested: false,
  ...patch,
})

describe('判形', () => {
  it('一份正经的表原样收下', () => {
    const got = acceptPackages([pkg()])
    expect(got).toHaveLength(1)
    expect(got[0]!.entries[0]!.id).toBe('data')
  })

  it('不是数组、不是对象、没有 pkg 的都丢掉，不崩', () => {
    expect(acceptPackages(undefined)).toEqual([])
    expect(acceptPackages({ pkg: 'x' })).toEqual([])
    expect(acceptPackages([null, 7, { 没有: 'pkg' }])).toEqual([])
  })

  it('坏的那条条目丢掉，同一个包里好的那条留着', () => {
    const got = acceptPackages([{ ...pkg(), entries: [entry(), { id: 7 }, null] }])
    expect(got[0]!.entries.map((e) => e.id)).toEqual(['data'])
  })

  it('entryId 缺了就用不带前缀的 id——命令收的是 entryId，空着等于这条条目操作不了', () => {
    const got = acceptPackages([{ ...pkg(), entries: [{ id: 'data', entryId: '' }] }])
    expect(got[0]!.entries[0]!.entryId).toBe('data')
  })

  it('disabled / active / group 只认 true，别的一律当 false', () => {
    const got = acceptPackages([{ ...pkg(), entries: [{ id: 'x', disabled: 'yes', active: 1, group: 'true' }] }])
    expect(got[0]!.entries[0]).toMatchObject({ disabled: false, active: false, group: false })
  })

  it('spec 没有就是没有（那种包 installed 也是 false）', () => {
    const got = acceptPackages([{ pkg: 'a', installed: false, entries: [] }])
    expect(got[0]).toEqual({ pkg: 'a', installed: false, entries: [], kernelUntested: false })
  })
})

describe('条目的状态：active 与 disabled 是两回事', () => {
  it('没停用 + 在运行 = 已加载', () => {
    expect(stateOf({ disabled: false, active: true })).toBe('active')
  })

  it('**没停用 + 没运行起来 = 没加载起来**，不是「已停用」', () => {
    expect(stateOf({ disabled: false, active: false })).toBe('stalled')
  })

  it('停用了 + 没运行 = 已停用', () => {
    expect(stateOf({ disabled: true, active: false })).toBe('disabled')
  })

  it('停用了却还在运行也说得清——两个字段不合成一个状态', () => {
    expect(stateOf({ disabled: true, active: true })).toBe('disabled-running')
  })
})

describe('三种文案', () => {
  const rowFor = (patch: Partial<EntryView>) => toRows([pkg({ entries: [entry(patch)] })])[0]!.entries[0]!

  it('已加载：不显眼', () => {
    const row = rowFor({ active: true })
    expect(row.text).toBe('已加载')
    expect(row.attention).toBe(false)
  })

  it('**没加载起来：最该被看见**，而且文案里不许出现「停用」', () => {
    const row = rowFor({ active: false })
    expect(row.text).toBe('没加载起来')
    expect(row.attention).toBe(true)
    expect(row.text).not.toContain('停用')
    // 一句话说清多半是为什么——不然人只知道它没加载起来
    expect(row.hint).toContain('inject')
  })

  it('已停用：是人要它停的，不显眼', () => {
    const row = rowFor({ disabled: true, active: false })
    expect(row.text).toBe('已停用')
    expect(row.attention).toBe(false)
  })

  it('**没有条目 ≠ 未启用**：没有条目就没有加载，跟「有条目但停用了」是两回事', () => {
    const row = toRows([pkg({ pkg: '@godcreator/gwb-x', entries: [] })])[0]!
    expect(row.note).toBe('没有条目')
    expect(row.note).not.toContain('启用')
    expect(row.noteHint).toContain('加一条条目')
    expect(row.noteHint).toContain('卸载')
  })

  it('有条目的包不带这句话', () => {
    expect(toRows([pkg()])[0]!.note).toBeUndefined()
  })
})

describe('两层行', () => {
  it('一个包有两条条目就是两行，各自一份状态', () => {
    const row = toRows([
      pkg({ entries: [entry(), entry({ id: 'data-2', entryId: 'home:data-2', disabled: true, active: false })] }),
    ])[0]!
    expect(row.entries.map((e) => [e.id, e.text])).toEqual([
      ['data', '已加载'],
      ['data-2', '已停用'],
    ])
  })

  it('启用／停用开关看的是 disabled 不是 active——没加载起来的条目照样能「停用」', () => {
    const row = toRows([pkg({ entries: [entry({ active: false })] })])[0]!
    expect(row.entries[0]!.disabled).toBe(false)
  })

  it('包不在 home 里时如实报出来，条目还在', () => {
    const row = toRows([{ pkg: '@godcreator/gwb-x', installed: false, kernelUntested: false, entries: [entry({ id: 'x' })] }])[0]!
    expect(row.installed).toBe(false)
    expect(row.entries).toHaveLength(1)
  })

  it('顺序照收，不重排——插件管理已经按包名排好了', () => {
    const rows = toRows([pkg({ pkg: 'b', entries: [] }), pkg({ pkg: 'a', entries: [] })])
    expect(rows.map((r) => r.pkg)).toEqual(['b', 'a'])
  })

  it('cordis 的分组条目不是插件，不显示', () => {
    const row = toRows([pkg({ entries: [entry(), entry({ id: 'g', group: true })] })])[0]!
    expect(row.entries.map((e) => e.id)).toEqual(['data'])
  })

  it('只剩分组条目、连包名都没有的那个「包」整条丢掉', () => {
    expect(toRows([{ pkg: '', installed: false, kernelUntested: false, entries: [entry({ id: 'g', pkg: '', group: true })] }])).toEqual([])
  })

  it('包名是空串但条目不是分组的，留着并说清楚', () => {
    const rows = toRows([{ pkg: '', installed: false, kernelUntested: false, entries: [entry({ id: 'x', pkg: '' })] }])
    expect(rows[0]!.title).toBe('（条目没写 name）')
  })
})

describe('没在当前内核上测过', () => {
  it('kernelRange 与 kernelUntested 原样收下；kernelUntested 只认 true', () => {
    const got = acceptPackages([
      { ...pkg(), kernelRange: '^0.2.1', kernelUntested: true },
      { ...pkg({ pkg: 'b' }), kernelUntested: 'yes' },
    ])
    expect(got[0]).toMatchObject({ kernelRange: '^0.2.1', kernelUntested: true })
    expect(got[1]!.kernelUntested).toBe(false)
    expect(got[1]!.kernelRange).toBeUndefined()
  })

  it('空串的 kernelRange 当没声明', () => {
    expect(acceptPackages([{ ...pkg(), kernelRange: '', kernelUntested: true }])[0]!.kernelRange).toBeUndefined()
  })

  it('toRows 把两个字段带到包那一行上', () => {
    const row = toRows([pkg({ kernelRange: '^0.1.0', kernelUntested: true })])[0]!
    expect(row).toMatchObject({ kernelRange: '^0.1.0', kernelUntested: true })
  })

  it('测过的包不标', () => {
    expect(kernelTestMark({ kernelUntested: false, kernelRange: '^0.3.0' })).toBeUndefined()
  })

  it('没测过：标记上显示声明的内核版本范围', () => {
    const mark = kernelTestMark({ kernelUntested: true, kernelRange: '^0.1.0' })!
    expect(mark.text).toContain('^0.1.0')
    expect(mark.hint).toContain('^0.1.0')
  })

  it('没声明：标记上写「未声明」，提示写在 peer 里', () => {
    const mark = kernelTestMark({ kernelUntested: true })!
    expect(mark.text).toContain('未声明')
    expect(mark.hint).toContain('@godcreator/gwb-kernel-desktop')
  })
})

describe('汇总', () => {
  it('数包、数条目、数「没加载起来」那几条', () => {
    const rows = toRows([
      pkg({ entries: [entry(), entry({ id: 'b', active: false })] }),
      pkg({ pkg: '@godcreator/gwb-x', entries: [] }),
    ])
    expect(summarize(rows)).toEqual({ packages: 2, entries: 2, attention: 1 })
  })

  it('空表是三个零', () => {
    expect(summarize([])).toEqual({ packages: 0, entries: 0, attention: 0 })
  })
})

describe('命令回执', () => {
  it('成了就把 data 交出来', () => {
    expect(asResult({ ok: true, data: [1] })).toEqual({ ok: true, data: [1] })
  })

  it('**error 一个字都不丢**——失败原因与 pnpm 输出的最后几行都只在这一句里', () => {
    const got = asResult({ ok: false, error: 'pnpm add 没成（退出码 1）\nERR_PNPM_NO_MATCHING_VERSION' })
    expect(got.ok).toBe(false)
    expect(got.error).toBe('pnpm add 没成（退出码 1）\nERR_PNPM_NO_MATCHING_VERSION')
  })

  it('没成却没给话时也得有句话——空提示跟没提示一样', () => {
    expect(asResult({ ok: false }).error).not.toBe('')
    expect(asResult({ ok: false, error: '' }).error).not.toBe('')
  })

  it('回了个认不出的东西也当没成，不崩', () => {
    expect(asResult(undefined).ok).toBe(false)
    expect(asResult('炸了').ok).toBe(false)
  })

  it('没有 ok 字段的一律当没成——缺了它这份回执本来就不算数', () => {
    expect(asResult({ data: [1] }).ok).toBe(false)
  })
})
