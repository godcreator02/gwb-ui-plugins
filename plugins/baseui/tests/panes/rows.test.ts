import { describe, expect, it } from 'vitest'
import type { EntrySnapshot, PluginPackageView } from '@godcreator/gwb-plugin-manager/receipts'
import {
  asResult,
  stateOf,
  summarize,
  toRows,
  unmetPeerMark,
} from '../../src/client/panes/plugin-manager/rows'

const entry = (patch: Partial<EntrySnapshot> = {}): EntrySnapshot => ({
  id: 'data',
  entryId: 'home:data',
  pkg: '@godcreator/gwb-data',
  disabled: false,
  active: true,
  group: false,
  ...patch,
})

const pkg = (patch: Partial<PluginPackageView> = {}): PluginPackageView => ({
  pkg: '@godcreator/gwb-data',
  spec: '0.0.2',
  installed: true,
  entries: [entry()],
  unmetPeers: [],
  ...patch,
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
  const rowFor = (patch: Partial<EntrySnapshot>) => toRows([pkg({ entries: [entry(patch)] })])[0]!.entries[0]!

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
    const row = toRows([{ pkg: '@godcreator/gwb-x', installed: false, unmetPeers: [], entries: [entry({ id: 'x' })] }])[0]!
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
    expect(toRows([{ pkg: '', installed: false, unmetPeers: [], entries: [entry({ id: 'g', pkg: '', group: true })] }])).toEqual([])
  })

  it('包名是空串但条目不是分组的，留着', () => {
    const rows = toRows([{ pkg: '', installed: false, unmetPeers: [], entries: [entry({ id: 'x', pkg: '' })] }])
    expect(rows.map((r) => [r.pkg, r.entries.map((e) => e.id)])).toEqual([['', ['x']]])
  })
})

describe('peer 没满足', () => {
  const kernelPeer = { pkg: '@godcreator/gwb-kernel-desktop', range: '^0.6.0', installed: '0.7.2' }
  const shellPeer = { pkg: '@godcreator/gwb-shell', range: '^0.13.0' }

  it('toRows 把 unmetPeers 带到包那一行上', () => {
    const row = toRows([pkg({ unmetPeers: [kernelPeer] })])[0]!
    expect(row.unmetPeers).toEqual([kernelPeer])
  })

  it('全满足的包不标', () => {
    expect(unmetPeerMark({ unmetPeers: [] })).toBeUndefined()
  })

  it('标签写「peer 没满足」，悬停提示逐项列出包名、要的范围、装着的版本', () => {
    const mark = unmetPeerMark({ unmetPeers: [{ pkg: '@godcreator/gwb-logger', range: '^0.5.0', installed: '0.4.3' }] })!
    expect(mark.text).toBe('peer 没满足')
    expect(mark.hint).toContain('@godcreator/gwb-logger 要 ^0.5.0，装着 0.4.3')
  })

  it('没装的写「没装」', () => {
    expect(unmetPeerMark({ unmetPeers: [shellPeer] })!.hint).toContain('@godcreator/gwb-shell 要 ^0.13.0，没装')
  })

  it('内核包那一项比的是运行中的内核，照这个说', () => {
    expect(unmetPeerMark({ unmetPeers: [kernelPeer] })!.hint).toContain('@godcreator/gwb-kernel-desktop 要 ^0.6.0，运行中的内核是 0.7.2')
  })

  it('几项就列几行', () => {
    const hint = unmetPeerMark({ unmetPeers: [kernelPeer, shellPeer] })!.hint
    expect(hint).toContain('@godcreator/gwb-kernel-desktop')
    expect(hint).toContain('@godcreator/gwb-shell')
  })
})

describe('汇总', () => {
  it('数包、数条目', () => {
    const rows = toRows([
      pkg({ entries: [entry(), entry({ id: 'b', active: false })] }),
      pkg({ pkg: '@godcreator/gwb-x', entries: [] }),
    ])
    expect(summarize(rows)).toEqual({ packages: 2, entries: 2 })
  })

  it('空表是两个零', () => {
    expect(summarize([])).toEqual({ packages: 0, entries: 0 })
  })
})

describe('命令回执', () => {
  it('成了就把 data 交出来', () => {
    expect(asResult({ ok: true, data: [1] })).toEqual({ ok: true, data: [1] })
  })

  it('**error 一个字都不丢**——失败原因与 pnpm 输出的最后几行都只在这一句里', () => {
    const got = asResult({ ok: false, error: 'pnpm add 没成（退出码 1）\nERR_PNPM_NO_MATCHING_VERSION' })
    expect(got).toEqual({ ok: false, error: 'pnpm add 没成（退出码 1）\nERR_PNPM_NO_MATCHING_VERSION' })
  })

  it('没成却没给话时也得有句话——空提示跟没提示一样', () => {
    for (const raw of [{ ok: false }, { ok: false, error: '' }]) {
      const got = asResult(raw)
      if (got.ok) throw new Error('应当是失败回执')
      expect(got.error).not.toBe('')
    }
  })

  it('回了个认不出的东西也当没成，不崩', () => {
    expect(asResult(undefined).ok).toBe(false)
    expect(asResult('炸了').ok).toBe(false)
  })

  it('没有 ok 字段的一律当没成——缺了它这份回执本来就不算数', () => {
    expect(asResult({ data: [1] }).ok).toBe(false)
  })
})
