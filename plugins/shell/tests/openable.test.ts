import { describe, expect, it } from 'vitest'
import {
  carriedTitle,
  planSend,
  groupForLauncher,
  listOpenable,
  panelIdOf,
  planLaunch,
  planOpen,
  sideGroupOf,
  specForOwnPane,
  specForPane,
  specsForDefaults,
  splitHeightFix,
  targetGroup,
  titleForOrdinal,
  uniquePanelId,
  type Desk,
  type DeskGroup,
  type DeskTab,
  type OpenableSpec,
  type OpenContext,
} from '../src/openable.js'
import { PLUGIN_COMPONENT } from '../src/panels.js'
import type { RegisteredPane } from '../src/pane-registry.js'

/**
 * 注册表快照 → 窗格容器里能开的那几个窗格。默认布局、状态栏的＋列表、导航行项用的是同一份，
 * 所以这份判据是纯的、在 node 里直接跑。
 */

const echo: RegisteredPane = {
  entryId: 'echo',
  pkg: '@godcreator/gwb-echo',
  id: 'main',
  title: '回声',
  icon: 'megaphone',
  kind: 'tool',
}

/** 同一个包挂的第二条条目 */
const echo2: RegisteredPane = { ...echo, entryId: 'echo-2', title: '回声（二号）' }

/** 同一条条目的第二个窗格 */
const echoLog: RegisteredPane = { ...echo, id: 'log', title: '日志', icon: 'scroll-text' }

function panes(list: readonly RegisteredPane[]) {
  return listOpenable(list)
}

describe('listOpenable：注册表里一条对应一个能开的窗格', () => {
  it('一条注册出一条：id 两段，params 三样都带着，kind 跟着定义走（不进 params、不随布局保存）', () => {
    expect(panes([echo])).toEqual([
      {
        id: 'plugin:echo:main',
        component: PLUGIN_COMPONENT,
        title: '回声',
        icon: 'megaphone',
        kind: 'tool',
        params: { pluginKey: '@godcreator/gwb-echo', entryId: 'echo', paneId: 'main' },
      },
    ])
    expect(panes([{ ...echo, kind: 'document' }])[0]!.kind).toBe('document')
  })

  it('没给 icon 的不带这个键——不塞一个空串进去', () => {
    const bare: RegisteredPane = { entryId: 'x', pkg: '@x/x', id: 'main', title: 'X', kind: 'tool' }
    expect(panes([bare])[0]).not.toHaveProperty('icon')
  })

  it('同一个包的两条条目：两个窗格分得开，pluginKey 是同一个', () => {
    const specs = panes([echo, echo2])
    expect(specs.map((s) => s.id)).toEqual(['plugin:echo:main', 'plugin:echo-2:main'])
    expect(new Set(specs.map((s) => s.params?.pluginKey)).size).toBe(1)
  })

  it('同一条条目的两个窗格：靠 paneId 分派', () => {
    const specs = panes([echo, echoLog])
    expect(specs.map((s) => [s.id, s.title])).toEqual([
      ['plugin:echo:main', '回声'],
      ['plugin:echo:log', '日志'],
    ])
    expect(specs.map((s) => s.params?.paneId)).toEqual(['main', 'log'])
  })

  it('空表回空表——「一个插件都没注册」跟「表没到手」是两回事,这儿只管前者', () => {
    expect(listOpenable([])).toEqual([])
  })

  it('不过滤：禁用的插件根本没跑 apply、注册不进来,在表里就等于该开得出来', () => {
    // 已退役的旧插件仓 gwb-plugins 里外壳插件那份 openable 要 `!disabled && !shell` 两条判断,是因为它用的是条目表；
    // 改成运行时注册之后，那两条判断连同它们会出的错一起去掉了
    expect(panes([echo])).toHaveLength(1)
  })
})

describe('groupForLauncher：启动器按插件分组', () => {
  it('按注册先后分组；组名取插件报的名字，没报就是包名', () => {
    const groups = groupForLauncher(listOpenable([echo, echoLog, echo2]), [{ entryId: 'echo', title: '回声件' }])
    expect(groups.map((g) => [g.entryId, g.title, g.specs.map((s) => s.id)])).toEqual([
      ['echo', '回声件', ['plugin:echo:main', 'plugin:echo:log']],
      ['echo-2', '@godcreator/gwb-echo', ['plugin:echo-2:main']],
    ])
  })
})

describe('specForOwnPane：插件说「打开我的某个窗格」', () => {
  it('认得出自己的那个窗格', () => {
    expect(specForOwnPane([echo, echoLog], 'echo', 'log')?.id).toBe('plugin:echo:log')
  })

  it('写错一个字回 undefined——不在窗格容器里凭空多出一个空白窗格', () => {
    expect(specForOwnPane([echo], 'echo', 'nope')).toBeUndefined()
    expect(specForOwnPane([], 'echo', 'main')).toBeUndefined()
  })

  it('打不开别人条目的窗格:窗格 id 对上了但条目不是自己的,一样回 undefined', () => {
    expect(specForOwnPane([echo2], 'echo', 'main')).toBeUndefined()
  })
})

describe('panelIdOf：两段都进去,只有这一处这么拼', () => {
  it('随布局保存的 id 跟注册表这边的算法是同一处', () => {
    expect(panelIdOf('echo', 'main')).toBe('plugin:echo:main')
    expect(listOpenable([echo])[0]!.id).toBe(panelIdOf(echo.entryId, echo.id))
  })

  it('实机的 entryId 自带 home: 前缀,拼出来是四段——这是条目 id 的真实形状', () => {
    // loader 把插件的条目登记在 include 那条下面,id 是全路径。上面那些用例的 `echo`
    // 是简写,这一条固定住真实的形状
    const real: RegisteredPane = { entryId: 'home:hello', pkg: '@godcreator/gwb-hello', id: 'main', title: '验收件', kind: 'tool' }
    expect(panelIdOf(real.entryId, real.id)).toBe('plugin:home:hello:main')
    expect(panes([real])[0]).toMatchObject({
      id: 'plugin:home:hello:main',
      params: { entryId: 'home:hello', paneId: 'main' },
    })
  })
})

/** 窗格容器里已经有这几个 id */
function taken(...ids: string[]): (id: string) => boolean {
  const set = new Set(ids)
  return (id: string) => set.has(id)
}

describe('uniquePanelId：定义 → 这一份实例', () => {
  it('窗格容器里没有就是基名本身——第一份跟只能开一份的那些窗格长得一模一样', () => {
    expect(uniquePanelId('plugin:home:hello:counter', taken())).toEqual({
      id: 'plugin:home:hello:counter',
      ordinal: 1,
    })
  })

  it('基名占着就接 :2，再占着接 :3', () => {
    const base = 'plugin:home:hello:counter'
    expect(uniquePanelId(base, taken(base))).toEqual({ id: `${base}:2`, ordinal: 2 })
    expect(uniquePanelId(base, taken(base, `${base}:2`))).toEqual({ id: `${base}:3`, ordinal: 3 })
  })

  it('基名空出来但 :2 还占着 → 回基名', () => {
    // **这条最要紧**:查的是「此刻窗格容器里真有哪些」,不是任何一个计数器。恢复保存的
    // 布局之后再开新窗格不重名,靠的就是这条语义
    const base = 'plugin:home:hello:counter'
    expect(uniquePanelId(base, taken(`${base}:2`))).toEqual({ id: base, ordinal: 1 })
  })

  it('查重恒真时抛,不是无限循环——那个循环跑在 UI 线程上', () => {
    expect(() => uniquePanelId('x', () => true)).toThrow(/查重坏了/)
  })
})

describe('titleForOrdinal：第二份起标题带序号', () => {
  it('第一份原样，第二份起接 (n)', () => {
    expect(titleForOrdinal('计数器', 1)).toBe('计数器')
    expect(titleForOrdinal('计数器', 2)).toBe('计数器 (2)')
    expect(titleForOrdinal('计数器', 3)).toBe('计数器 (3)')
  })
})

// ─── 一张桌面的快照：下面几组都在它上面判 ─────────────────────────────────

/** 下面几组要开的那个窗格：`specForPane({ ...echo, id: 'counter' })` 的基名 */
const BASE = 'plugin:echo:counter'
/** 工具窗格版的那个（注册时不说 kind 就是它） */
const counter = specForPane({ ...echo, id: 'counter', title: '计数器', icon: 'hash' })
/** 同一个窗格注册成文档窗格 */
const docCounter: OpenableSpec = { ...counter, kind: 'document' }
const who = { entryId: 'echo', paneId: 'counter' }
const COUNTER = { entryId: 'echo', paneId: 'counter' }

/** 要开的那个定义的一个标签 */
function tab(id: string, key: string, preview = false): DeskTab {
  return { id, entryId: 'echo', paneId: 'counter', key, preview }
}

/** 别的定义（同一条条目的 log 窗格）的一个标签 */
function other(id: string, key = '', preview = false): DeskTab {
  return { id, entryId: 'echo', paneId: 'log', key, preview }
}

/** 排成一排的第 i 列（组宽 292、组间缝 8，跟实机的 gap 同一个数） */
function col(i: number, row = 0, rows = 1): DeskGroup['box'] {
  const h = rows === 1 ? 600 : 296
  return { x: i * 300, y: row * 304, w: 292, h }
}

/** 一组。活动标签缺省是第一个 */
function group(id: string, tabs: DeskTab[], box: DeskGroup['box'], active: string | undefined = tabs[0]?.id): DeskGroup {
  return { id, tabs, box, ...(active === undefined ? {} : { active }) }
}

function desk(groups: DeskGroup[], opts: { active?: string; recent?: string[] } = {}): Desk {
  return {
    groups,
    ...(opts.active === undefined ? (groups[0] === undefined ? {} : { activeGroup: groups[0].id }) : { activeGroup: opts.active }),
    recent: opts.recent ?? [],
  }
}

/** 别的桌面上开着的一份（`OpenContext.elsewhere` 从这些里找） */
interface OtherTab {
  desktop: string
  id: string
  key: string
  preview?: boolean
  paneId?: string
}

/**
 * 判断的上下文：查重看这张桌面的全部 id，外加别的桌面占着的那些（`elsewhere` 只占号；`onOther`
 * 是别的桌面上开着的窗格，既占号、也让工具窗格找得到）。哪一类看的是定义自己的 kind
 */
function ctx(d: Desk, extra: { from?: string; elsewhere?: string[]; onOther?: OtherTab[] } = {}): OpenContext {
  const onOther = extra.onOther ?? []
  const ids = new Set([...d.groups.flatMap((g) => g.tabs.map((t) => t.id)), ...(extra.elsewhere ?? []), ...onOther.map((t) => t.id)])
  return {
    desk: d,
    taken: (id) => ids.has(id),
    elsewhere: (def, key) => {
      const hit = onOther.find((t) => def.entryId === 'echo' && def.paneId === (t.paneId ?? 'counter') && t.key === key)
      return hit === undefined ? undefined : { desktop: hit.desktop, id: hit.id, preview: hit.preview === true }
    },
    ...(extra.from === undefined ? {} : { from: extra.from }),
  }
}

/** plan 里那份面板 params（开出来的或原地换进去的） */
function paramsOf(plan: ReturnType<typeof planOpen>) {
  if (plan.kind === 'open') return plan.spec.params
  return plan.kind === 'retarget' ? plan.params : undefined
}

/**
 * **侧边组**：某一组右边紧挨着的那一组。组的矩形由执行侧（`client/open.ts`）从 dockview 量来（实机组间缝 8px），
 * 判断只用矩形，所以嵌套成什么样都一样判。
 */
describe('sideGroupOf：右边紧挨着的那一组', () => {
  it('一排里右边那组就是侧边组；最右那组没有侧边组', () => {
    const d = desk([group('g1', [], col(0)), group('g2', [], col(1)), group('g3', [], col(2))])
    expect(sideGroupOf(d, 'g1')).toBe('g2')
    expect(sideGroupOf(d, 'g2')).toBe('g3')
    expect(sideGroupOf(d, 'g3')).toBeUndefined()
  })

  it('下面那组、隔着一组的那组都不算', () => {
    const d = desk([group('top', [], col(0, 0, 2)), group('bottom', [], col(0, 1, 2)), group('far', [], { x: 900, y: 0, w: 292, h: 600 })])
    expect(sideGroupOf(d, 'top')).toBeUndefined()
  })

  it('右边一列叠着好几组：竖向跟基准组重叠最多的那一组；重叠一样取靠上的', () => {
    // 左边一整列高 600；右边上 200、下 392 → 下面那组重叠多
    const d = desk([
      group('left', [], { x: 0, y: 0, w: 292, h: 600 }),
      group('rUp', [], { x: 300, y: 0, w: 292, h: 200 }),
      group('rDown', [], { x: 300, y: 208, w: 292, h: 392 }),
    ])
    expect(sideGroupOf(d, 'left')).toBe('rDown')
    const even = desk([
      group('left', [], { x: 0, y: 0, w: 292, h: 600 }),
      group('rUp', [], { x: 300, y: 0, w: 292, h: 296 }),
      group('rDown', [], { x: 300, y: 304, w: 292, h: 296 }),
    ])
    expect(sideGroupOf(even, 'left')).toBe('rUp')
  })

  it('只擦到一个角的不算（竖向不重叠）', () => {
    const d = desk([group('a', [], { x: 0, y: 0, w: 292, h: 296 }), group('b', [], { x: 300, y: 304, w: 292, h: 296 })])
    expect(sideGroupOf(d, 'a')).toBeUndefined()
  })
})

/**
 * **目标组怎么定**（spec「目标组怎么定」一行一条）。输入是窗格定义、放法、来源窗格；
 * 桌面由执行侧挑好（有来源是来源那张，否则当前那张），这儿只在一张桌面里算。
 */
describe('targetGroup：side（开到旁边）', () => {
  it('基准组是来源所在的组，它右边有侧边组 → 目标就是侧边组（复用，不新建）', () => {
    const d = desk([group('g1', [other('src')], col(0)), group('g2', [other('x')], col(1))], { active: 'g2' })
    expect(targetGroup(d, COUNTER, 'side', 'src')).toEqual({ group: 'g2' })
  })

  it('右边没有侧边组 → 把基准组对半分，右半边是新组', () => {
    const d = desk([group('g1', [other('x')], col(0)), group('g2', [other('src')], col(1))], { active: 'g1' })
    expect(targetGroup(d, COUNTER, 'side', 'src')).toEqual({ split: 'g2' })
  })

  it('没有来源 → 基准组是这张桌面的活动组', () => {
    const d = desk([group('g1', [other('a')], col(0)), group('g2', [other('b')], col(1))], { active: 'g1' })
    expect(targetGroup(d, COUNTER, 'side')).toEqual({ group: 'g2' })
    expect(targetGroup(desk(d.groups, { active: 'g2' }), COUNTER, 'side')).toEqual({ split: 'g2' })
  })

  it('来源同定义也照 side 算：side 不看定义', () => {
    const d = desk([group('g1', [tab('src', 'a')], col(0))])
    expect(targetGroup(d, COUNTER, 'side', 'src')).toEqual({ split: 'g1' })
  })

  it('桌面是空的 → 新建一组', () => {
    expect(targetGroup(desk([]), COUNTER, 'side')).toEqual({ empty: true })
  })
})

describe('targetGroup：auto（缺省），按顺序取第一个成立的', () => {
  it('1. 来源与要开的是同一个窗格定义 → 来源所在的组（笔记里 Ctrl+单击，开在这一列）', () => {
    // 最近用过的同类组是 g2，但来源同定义优先
    const d = desk([group('g1', [tab('src', 'a')], col(0)), group('g2', [tab('b1', 'b')], col(1))], { active: 'g2', recent: ['g2', 'g1'] })
    expect(targetGroup(d, COUNTER, 'auto', 'src')).toEqual({ group: 'g1' })
  })

  it('2. 这张桌面上有最近用过的同类组 → 那一组（从查询视图里点一条，落到最近在用的那一列正文）', () => {
    const d = desk(
      [group('view', [other('src')], col(0)), group('g2', [tab('b1', 'b')], col(1)), group('g3', [tab('c1', 'c')], col(2))],
      { active: 'view', recent: ['view', 'g3', 'g2'] },
    )
    // recent 里最前的是 view——它不装同一定义，跳过；下一个 g3 装着 → g3
    expect(targetGroup(d, COUNTER, 'auto', 'src')).toEqual({ group: 'g3' })
  })

  it('2. 最近用过的组已经没了（关掉了）不算，跳到下一个', () => {
    const d = desk([group('g2', [tab('b1', 'b')], col(0))], { recent: ['gone', 'g2'] })
    expect(targetGroup(d, COUNTER, 'auto')).toEqual({ group: 'g2' })
  })

  it('3. 有来源、没有同类组 → 照 side 算：右边有侧边组就开进它', () => {
    const d = desk([group('tree', [other('src')], col(0)), group('g2', [other('x')], col(1))], { active: 'g2' })
    expect(targetGroup(d, COUNTER, 'auto', 'src')).toEqual({ group: 'g2' })
  })

  it('3. 有来源、没有同类组、右边也没有组 → 把来源那组对半分（单元树旁边开原文，不盖住单元树）', () => {
    const d = desk([group('tree', [other('src')], col(0))])
    expect(targetGroup(d, COUNTER, 'auto', 'src')).toEqual({ split: 'tree' })
  })

  it('4. 没有来源、没有同类组 → 活动组', () => {
    const d = desk([group('g1', [other('a')], col(0)), group('g2', [other('b')], col(1))], { active: 'g2' })
    expect(targetGroup(d, COUNTER, 'auto')).toEqual({ group: 'g2' })
  })

  it('5. 桌面是空的 → 新建一组', () => {
    expect(targetGroup(desk([]), COUNTER, 'auto')).toEqual({ empty: true })
  })

  it('来源不在这张桌面上（执行侧没找到）等于没有来源', () => {
    const d = desk([group('g1', [other('a')], col(0))])
    expect(targetGroup(d, COUNTER, 'auto', 'ghost')).toEqual({ group: 'g1' })
  })
})

/**
 * **打开窗格 · 文档窗格**（spec 那张表一行一条）。只在**目标组**里查重。
 */
describe('planOpen · 文档窗格：只在目标组里查重', () => {
  it('目标组里有同 key 的标签、不要预览 → 激活它；它是预览标签就转成正式窗格', () => {
    const d = desk([group('g1', [tab(BASE, 'a', true)], col(0))])
    expect(planOpen(docCounter, { key: 'a' }, ctx(d), who)).toEqual({ kind: 'focus', id: BASE, keep: true })
    const formal = desk([group('g1', [tab(BASE, 'a')], col(0))])
    expect(planOpen(docCounter, { key: 'a' }, ctx(formal), who)).toEqual({ kind: 'focus', id: BASE })
  })

  it('目标组里有同 key 的标签、要预览 → 激活它，不改它的预览状态', () => {
    const d = desk([group('g1', [tab(BASE, 'a')], col(0))])
    expect(planOpen(docCounter, { key: 'a', preview: true }, ctx(d), who)).toEqual({ kind: 'focus', id: BASE })
    const pv = desk([group('g1', [tab(BASE, 'a', true)], col(0))])
    expect(planOpen(docCounter, { key: 'a', preview: true }, ctx(pv), who)).toEqual({ kind: 'focus', id: BASE })
  })

  it('没有同 key、组里有预览标签、要预览 → 原地换掉它（位置不动）', () => {
    const d = desk([group('g1', [other('o1'), tab(BASE, 'a', true), other('o2')], col(0), 'o1')])
    const plan = planOpen(docCounter, { key: 'b', preview: true, params: { root: 'b' } }, ctx(d), who)
    expect(plan).toMatchObject({ kind: 'retarget', id: BASE })
    expect(paramsOf(plan)).toEqual({
      pluginKey: '@godcreator/gwb-echo',
      entryId: 'echo',
      paneId: 'counter',
      icon: 'hash',
      key: 'b',
      preview: true,
      root: 'b',
    })
  })

  it('没有同 key、组里没有预览标签、要预览 → 在目标组开新的预览标签，插在活动标签右边', () => {
    const d = desk([group('g1', [other('o1'), other('o2'), other('o3')], col(0), 'o2')])
    const plan = planOpen(docCounter, { key: 'b', preview: true }, ctx(d), who)
    expect(plan).toMatchObject({ kind: 'open', id: BASE, at: { group: 'g1', index: 2 } })
    expect(paramsOf(plan)).toMatchObject({ key: 'b', preview: true })
  })

  it('没有同 key、不要预览 → 在目标组开新的正式标签，插在活动标签右边', () => {
    const d = desk([group('g1', [tab(BASE, 'a'), other('o1')], col(0))])
    const plan = planOpen(docCounter, { key: 'b' }, ctx(d), who)
    expect(plan).toMatchObject({ kind: 'open', id: `${BASE}:2`, title: '计数器 (2)', at: { group: 'g1', index: 1 } })
    expect(paramsOf(plan)).not.toHaveProperty('preview')
  })

  it('同一内容在**别的组**开着不算命中：就在目标组再开一份', () => {
    // 来源同定义 → 目标组是来源那组 g2；a 开在 g1，不跳过去
    const d = desk([group('g1', [tab(BASE, 'a')], col(0)), group('g2', [tab(`${BASE}:2`, 'x')], col(1))])
    const plan = planOpen(docCounter, { key: 'a' }, ctx(d, { from: `${BASE}:2` }), who)
    expect(plan).toMatchObject({ kind: 'open', id: `${BASE}:3`, at: { group: 'g2', index: 1 } })
  })

  it('同一内容在**别的桌面**开着不算命中：本桌再开一份，序号跳过别的桌面占着的', () => {
    const d = desk([group('g1', [other('o1')], col(0))])
    const plan = planOpen(docCounter, { key: 'a' }, ctx(d, { elsewhere: [BASE] }), who)
    expect(plan).toMatchObject({ kind: 'open', id: `${BASE}:2`, at: { group: 'g1' } })
  })

  it('目标组要新建（对半分 / 空桌面）时没有可查的，直接开', () => {
    const d = desk([group('tree', [other('src')], col(0))])
    expect(planOpen(docCounter, { key: 'a' }, ctx(d, { from: 'src' }), who)).toMatchObject({
      kind: 'open',
      id: BASE,
      at: { split: 'tree' },
    })
    expect(planOpen(docCounter, { key: 'a' }, ctx(desk([])), who)).toMatchObject({ kind: 'open', at: { empty: true } })
  })
})

/**
 * **打开窗格 · 工具窗格**（spec 那张表一行一条）。工具窗格**全页一份**（2026-09-19 人决定，推翻
 * 「每张桌面各一份」）：先在本桌所有组里找，本桌没有再去别的桌面找——在别的桌面就到那张桌面
 * 激活它（`reveal`），不在本桌再开一份。切不切过去归调用方（人点的切，插件与命令开的只提示）。
 */
describe('planOpen · 工具窗格：全页一份', () => {
  it('本桌有同一定义、同一 key 的实例 → 激活它，在哪一组就在哪一组，不挪', () => {
    // 活动组是 g2，工具开在 g1 → 还是激活 g1 里那个
    const d = desk([group('g1', [tab(BASE, '')], col(0)), group('g2', [other('o')], col(1))], { active: 'g2' })
    expect(planOpen(counter, undefined, ctx(d), who)).toEqual({ kind: 'focus', id: BASE })
  })

  it('命中的是预览标签、这次是正式打开 → 转成正式窗格', () => {
    const d = desk([group('g1', [tab(BASE, '', true)], col(0))])
    expect(planOpen(counter, undefined, ctx(d), who)).toEqual({ kind: 'focus', id: BASE, keep: true })
  })

  it('本桌没有 → 按目标组规则开一份，插在活动标签右边', () => {
    const d = desk([group('g1', [other('o1'), other('o2')], col(0), 'o1')])
    expect(planOpen(counter, undefined, ctx(d), who)).toMatchObject({ kind: 'open', id: BASE, at: { group: 'g1', index: 1 } })
  })

  it('别的桌面开着同一定义、同一 key 的 → 到那张桌面激活它（reveal），本桌不再开一份', () => {
    const d = desk([group('g1', [other('o1')], col(0))])
    expect(planOpen(counter, undefined, ctx(d, { onOther: [{ desktop: 'd2', id: BASE, key: '' }] }), who)).toEqual({
      kind: 'reveal',
      desktop: 'd2',
      id: BASE,
    })
  })

  it('别的桌面那份是预览标签、这次是正式打开 → reveal 并转成正式窗格', () => {
    const d = desk([group('g1', [other('o1')], col(0))])
    expect(
      planOpen(counter, undefined, ctx(d, { onOther: [{ desktop: 'd2', id: BASE, key: '', preview: true }] }), who),
    ).toEqual({ kind: 'reveal', desktop: 'd2', id: BASE, keep: true })
  })

  it('本桌与别的桌面都有（老版本留下的多份）→ 本桌那份优先，不切走', () => {
    const d = desk([group('g1', [tab(`${BASE}:2`, '')], col(0))])
    expect(planOpen(counter, undefined, ctx(d, { onOther: [{ desktop: 'd2', id: BASE, key: '' }] }), who)).toEqual({
      kind: 'focus',
      id: `${BASE}:2`,
    })
  })

  it('别的桌面那份 key 不同 → 不是同一份，本桌开一份新的（号照全页查重）', () => {
    const d = desk([group('g1', [other('o1')], col(0))])
    expect(planOpen(counter, { key: 'b' }, ctx(d, { onOther: [{ desktop: 'd2', id: BASE, key: 'a' }] }), who)).toMatchObject({
      kind: 'open',
      id: `${BASE}:2`,
    })
  })

  it('文档窗格不管别的桌面：能多开，本桌照开一份', () => {
    const d = desk([group('g1', [other('o1')], col(0))])
    expect(planOpen(docCounter, undefined, ctx(d, { onOther: [{ desktop: 'd2', id: BASE, key: '' }] }), who)).toMatchObject({
      kind: 'open',
      id: `${BASE}:2`,
    })
  })

  it('key 不同是不同的实例：本桌那份 key 对不上就不算命中', () => {
    const d = desk([group('g1', [tab(BASE, 'a')], col(0))])
    expect(planOpen(counter, { key: 'b' }, ctx(d), who)).toMatchObject({ kind: 'open', id: `${BASE}:2` })
  })

  it('preview 与 side 照收，语义同文档窗格：没命中时替换目标组的预览标签', () => {
    const d = desk([group('g1', [tab(BASE, 'a', true)], col(0))])
    expect(planOpen(counter, { key: 'b', preview: true }, ctx(d), who)).toMatchObject({ kind: 'retarget', id: BASE })
    const two = desk([group('g1', [other('src')], col(0)), group('g2', [other('x')], col(1))])
    expect(planOpen(counter, { placement: 'side' }, ctx(two, { from: 'src' }), who)).toMatchObject({
      kind: 'open',
      at: { group: 'g2' },
    })
  })
})

/**
 * **预览标签每组一个**，按窗格定义算（2026-09-19 人决定：一组里每种定义至多一个，原地换内容只在
 * 同一定义之内——`retarget` 本来就只对同一个插件的同一个窗格讲得通）。
 */
describe('planOpen 的预览：每组每个定义至多一个', () => {
  it('两组各有一个预览标签：只替换目标组的那个', () => {
    const d = desk([group('g1', [tab(BASE, 'a', true)], col(0)), group('g2', [tab(`${BASE}:2`, 'b', true)], col(1))], {
      active: 'g2',
    })
    expect(planOpen(docCounter, { key: 'c', preview: true }, ctx(d), who)).toMatchObject({
      kind: 'retarget',
      id: `${BASE}:2`,
    })
  })

  it('别的组有预览标签、目标组没有 → 在目标组新开一个预览标签（不去替换别组的）', () => {
    const d = desk([group('g1', [tab(BASE, 'a', true)], col(0)), group('g2', [other('o')], col(1))], { active: 'g2' })
    const plan = planOpen(docCounter, { key: 'c', preview: true }, ctx(d), who)
    expect(plan).toMatchObject({ kind: 'open', id: `${BASE}:2`, at: { group: 'g2' } })
    expect(paramsOf(plan)).toMatchObject({ preview: true })
  })

  it('目标组里别的定义的预览标签不被替换：各定义各有各的一个', () => {
    const d = desk([group('g1', [other('o1', 'x', true)], col(0))])
    const plan = planOpen(docCounter, { key: 'c', preview: true }, ctx(d), who)
    expect(plan).toMatchObject({ kind: 'open', id: BASE, at: { group: 'g1', index: 1 } })
  })

  it('没要 preview 的调用不碰预览标签——预览标签只被 preview 打开替换', () => {
    const d = desk([group('g1', [tab(BASE, 'a', true)], col(0))])
    expect(planOpen(docCounter, { key: 'b' }, ctx(d), who)).toMatchObject({ kind: 'open', id: `${BASE}:2` })
  })

  it('原地换内容那份 params 带着 icon：开窗格与原地换内容同一处拼，不然换完标签上的图标会变成缺省图标', () => {
    const d = desk([group('g1', [tab(BASE, 'a', true)], col(0))])
    expect(paramsOf(planOpen(docCounter, { key: 'b', preview: true }, ctx(d), who))).toMatchObject({ icon: 'hash' })
  })
})

/** 新标签插在哪：dockview 的 openPanel 不给 index 就追加到末尾，所以 index 由这儿算好 */
describe('planOpen 的插入位置：目标组活动标签的右边', () => {
  it('活动标签在最左 → index 1；在中间 → 它右边；在最右 → 末尾', () => {
    const tabs = [other('o1'), other('o2'), other('o3')]
    for (const [active, index] of [['o1', 1], ['o2', 2], ['o3', 3]] as const) {
      const d = desk([group('g1', tabs, col(0), active)])
      expect(planOpen(docCounter, undefined, ctx(d), who)).toMatchObject({ at: { group: 'g1', index } })
    }
  })

  it('组里说不出活动标签 → 追加到末尾', () => {
    const d = desk([group('g1', [other('o1'), other('o2')], col(0), undefined)])
    // group() 缺省把第一个当活动，这儿显式抹掉
    const bare: Desk = { ...d, groups: [{ id: 'g1', tabs: d.groups[0]!.tabs, box: col(0) }] }
    expect(planOpen(docCounter, undefined, ctx(bare), who)).toMatchObject({ at: { group: 'g1', index: 2 } })
  })
})

/**
 * 开多份时那几份靠什么彼此不同：插件在 `openPane` 里传一份参数，它合并进面板 params、
 * 随布局保存，再原样交给那一份的 `mountPane`。
 */
describe('planOpen 的 params：插件说这一份装的是什么', () => {
  const empty = desk([group('g1', [other('o')], col(0))])

  it('插件传的键跟三个识别字段放在同一份 params 里，key 也在', () => {
    const plan = planOpen(docCounter, { key: 'a.md', params: { file: 'a.md', line: 3 } }, ctx(empty), who)
    expect(paramsOf(plan)).toEqual({
      pluginKey: '@godcreator/gwb-echo',
      entryId: 'echo',
      paneId: 'counter',
      key: 'a.md',
      file: 'a.md',
      line: 3,
    })
  })

  it('不传 params 的调用方一个字不用改：面板 params 还是那三样加一个空身份', () => {
    expect(paramsOf(planOpen(docCounter, undefined, ctx(empty), who))).toEqual({ ...counter.params, key: '' })
  })

  it('不给 key 等于空串：「没给 key」不是特例，第二次点同一个窗格照样是聚焦', () => {
    const d = desk([group('g1', [tab(BASE, '')], col(0))])
    expect(planOpen(docCounter, undefined, ctx(d), who)).toEqual({ kind: 'focus', id: BASE })
    // 默认布局打开的那一份身上也没有 key，所以它跟「插件不给 key 开的那一份」是同一个窗格
    expect(planOpen(docCounter, { params: { file: 'a.md' } }, ctx(d), who)).toEqual({ kind: 'focus', id: BASE })
  })

  it('保留键改不动这个窗格的身份：摘掉，而且要告警', () => {
    // **这条实机点不出来**——得专门写一个乱传参数的插件才走得到
    const plan = planOpen(
      counter,
      { key: 'a', params: { entryId: '别人的条目', pluginKey: '@x/x', icon: 'skull', file: 'a.md' } },
      ctx(empty),
      who,
    )
    expect(paramsOf(plan)).toEqual({
      pluginKey: '@godcreator/gwb-echo',
      entryId: 'echo',
      paneId: 'counter',
      key: 'a',
      file: 'a.md',
    })
    expect(plan.kind === 'open' ? plan.notice : '').toMatch(/保留键/)
  })

  it('`key` 与 `preview` 也是保留键：插件拿它们当自己的参数名会被摘掉并告警', () => {
    // 摘掉之后写上的是**外壳算出来的**那两个值，不是插件传的——身份归外壳
    const plan = planOpen(docCounter, { key: 'a', params: { key: '冒充的', preview: true } }, ctx(empty), who)
    expect(paramsOf(plan)).toEqual({ ...counter.params, key: 'a' })
    expect(plan.kind === 'open' ? plan.notice : '').toMatch(/保留键/)
  })

  it('聚焦已开的那份时参数不作数——那个窗格装的本来就是这份内容，改 params 只会让保存的布局跟界面对不上', () => {
    const d = desk([group('g1', [tab(BASE, 'a')], col(0))])
    expect(planOpen(docCounter, { key: 'a', params: { file: 'a.md' } }, ctx(d), who)).toEqual({ kind: 'focus', id: BASE })
  })

  it('原地换内容那条也要摘保留键、也要告警', () => {
    const d = desk([group('g1', [tab(BASE, 'a', true)], col(0))])
    const plan = planOpen(docCounter, { key: 'b', preview: true, params: { icon: 'skull' } }, ctx(d), who)
    expect(plan.kind).toBe('retarget')
    expect(plan.kind === 'retarget' ? plan.notice : '').toMatch(/保留键/)
  })

  it('认不出那个窗格 → 什么都不做,但话里要带得出是谁要开什么', () => {
    const plan = planOpen(undefined, undefined, ctx(empty), who)
    expect(plan.kind).toBe('none')
    expect(plan.kind === 'none' ? plan.notice : '').toContain('echo')
    expect(plan.kind === 'none' ? plan.notice : '').toContain('counter')
  })

  it('placement 认不出（旧插件乱传）当缺省 auto，不当 side', () => {
    const d = desk([group('g1', [tab('src', 'x')], col(0)), group('g2', [other('o')], col(1))], { active: 'g2' })
    const plan = planOpen(docCounter, { key: 'a', placement: 'left' as never }, ctx(d, { from: 'src' }), who)
    expect(plan).toMatchObject({ kind: 'open', at: { group: 'g1' } })
  })
})

/**
 * **状态栏「新建」**（启动器）：没有来源、在当前桌面。跟 `planOpen` 不同的两处：落点是**活动组**
 * （不走「最近用过的同类组」），文档窗格**不查重**——选它就是要开一份新的。
 */
describe('planLaunch：启动器选了一条之后', () => {
  it('文档窗格：在活动组开一份新的（key 空串、不带参数），插在活动标签右边；本桌已有空 key 的也照开', () => {
    const d = desk(
      [group('g1', [tab(BASE, '')], col(0)), group('g2', [other('o1'), other('o2')], col(1), 'o1')],
      { active: 'g2', recent: ['g1'] },
    )
    const plan = planLaunch(docCounter, ctx(d))
    expect(plan).toMatchObject({ kind: 'open', id: `${BASE}:2`, at: { group: 'g2', index: 1 } })
    expect(paramsOf(plan)).toEqual({ ...docCounter.params, key: '' })
  })

  it('工具窗格：本桌已有（空 key）就激活它，在哪一组就在哪一组', () => {
    const d = desk([group('g1', [tab(BASE, '')], col(0)), group('g2', [other('o1')], col(1))], { active: 'g2' })
    expect(planLaunch(counter, ctx(d))).toEqual({ kind: 'focus', id: BASE })
  })

  it('工具窗格：本桌那份是预览标签 → 激活并转成正式窗格', () => {
    const d = desk([group('g1', [tab(BASE, '', true)], col(0))])
    expect(planLaunch(counter, ctx(d))).toEqual({ kind: 'focus', id: BASE, keep: true })
  })

  it('工具窗格：本桌没有、别的桌面开着（空 key）→ reveal（切不切过去归调用方，启动器是切）', () => {
    const d = desk([group('g1', [other('o1')], col(0))])
    expect(planLaunch(counter, ctx(d, { onOther: [{ desktop: 'd3', id: `${BASE}:2`, key: '' }] }))).toEqual({
      kind: 'reveal',
      desktop: 'd3',
      id: `${BASE}:2`,
    })
    expect(planLaunch(counter, ctx(d, { onOther: [{ desktop: 'd3', id: BASE, key: '', preview: true }] }))).toEqual({
      kind: 'reveal',
      desktop: 'd3',
      id: BASE,
      keep: true,
    })
  })

  it('工具窗格：本桌与别的桌面都没有（空 key 的）→ 开进活动组（不去最近用过的同类组）', () => {
    const d = desk([group('g1', [tab(BASE, 'x')], col(0)), group('g2', [other('o1')], col(1))], { active: 'g2', recent: ['g1'] })
    expect(planLaunch(counter, ctx(d, { elsewhere: [`${BASE}:2`] }))).toMatchObject({
      kind: 'open',
      id: `${BASE}:3`,
      at: { group: 'g2', index: 1 },
    })
  })

  it('桌面是空的 → 新建一组', () => {
    expect(planLaunch(docCounter, ctx(desk([])))).toMatchObject({ kind: 'open', at: { empty: true } })
  })
})

/**
 * **送到别的桌面**：源桌面关掉、目标桌面按目标组规则开（没有来源）。送过去的一律是正式标签。
 */
describe('planSend：送过去之后在目标桌面怎么开', () => {
  it('文档窗格：没有来源，落最近用过的同类组，开一份正式的（预览不带过去），参数与 key 带过去', () => {
    const d = desk([group('g1', [other('o')], col(0)), group('g2', [tab(`${BASE}:7`, 'z')], col(1))], { active: 'g1', recent: ['g2'] })
    const plan = planSend(docCounter, { key: 'a', params: { root: 'a' } }, '计数器', ctx(d))
    expect(plan).toMatchObject({ kind: 'open', id: BASE, at: { group: 'g2', index: 1 } })
    expect(paramsOf(plan)).toEqual({ ...docCounter.params, key: 'a', root: 'a' })
  })

  it('文档窗格：目标组里已有同一内容也照开一份——送过去就是「我要在这儿有它」', () => {
    const d = desk([group('g1', [tab(BASE, 'a')], col(0))])
    expect(planSend(docCounter, { key: 'a' }, '计数器', ctx(d))).toMatchObject({ kind: 'open', id: `${BASE}:2` })
  })

  it('工具窗格：目标桌面已有同一定义同一 key → 只激活那一份', () => {
    const d = desk([group('g1', [tab(BASE, '')], col(0))])
    expect(planSend(counter, { key: '' }, '计数器', ctx(d))).toEqual({ kind: 'focus', id: BASE })
  })

  it('工具窗格：目标桌面没有 → 照文档那样开', () => {
    expect(planSend(counter, { key: '' }, '计数器', ctx(desk([])))).toMatchObject({ kind: 'open', at: { empty: true } })
  })

  it('标题：插件自己改过的原样带过去；缺省那种按新序号重算', () => {
    const d = desk([group('g1', [tab(BASE, 'x')], col(0))])
    expect(planSend(docCounter, { key: 'a' }, '第三章', ctx(d))).toMatchObject({ title: '第三章' })
    expect(planSend(docCounter, { key: 'a' }, '计数器 (4)', ctx(d))).toMatchObject({ title: '计数器 (2)' })
  })
})

/**
 * **默认布局打开哪几个窗格**（第一次启动、恢复不了、「重置布局」）：表里有几个开几个，但工具窗格全页
 * 一份——整页哪张桌面上已经开着（空 key 的那份）就不再开，文档窗格照开一份默认内容。
 */
describe('specsForDefaults：默认布局打开哪几个窗格', () => {
  const log = specForPane({ ...echoLog })
  it('整页都没开：全开', () => {
    expect(specsForDefaults([counter, log, docCounter], []).map((s) => s.id)).toEqual([BASE, log.id, BASE])
  })
  it('工具窗格别处开着（空 key）就不开；key 不同的不算；文档窗格照开', () => {
    const open = [
      { entryId: 'echo', paneId: 'counter', key: '' },
      { entryId: 'echo', paneId: 'log', key: 'x' },
    ]
    expect(specsForDefaults([counter, log, docCounter], open).map((s) => [s.id, s.kind])).toEqual([
      [log.id, 'tool'],
      [BASE, 'document'],
    ])
  })
})

describe('carriedTitle', () => {
  it('缺省标题（定义标题或带序号的）按新序号重算，别的原样', () => {
    expect(carriedTitle('计数器', '计数器', 3)).toBe('计数器 (3)')
    expect(carriedTitle('计数器 (5)', '计数器', 1)).toBe('计数器')
    expect(carriedTitle('计数器 (五)', '计数器', 1)).toBe('计数器 (五)')
    expect(carriedTitle('文档 B', '计数器', 2)).toBe('文档 B')
  })
})

/**
 * 对半分的补偿：dockview 8.3.1 在「基准组要跨轴包进新分支」时（基准组在一列里、往右分），
 * 把叶子**渲染后的高**当成分支的逻辑尺寸写回去，分支分到的组间缝少一份，多出来的高分给同一列的其他组。
 * 执行侧量出分之前与分之后基准组的高，这儿算该把它设成多少。
 */
describe('splitHeightFix：包进新分支时少掉的那份组间缝要补回来', () => {
  it('高没变（同一排里分，不包分支）→ 不补', () => {
    expect(splitHeightFix(635, 635)).toBeUndefined()
    // 组间缝重新平摊的亚像素抖动不算
    expect(splitHeightFix(635, 635.3)).toBeUndefined()
  })

  it('高少了 4（两组一列、缝 8）→ 逻辑尺寸设成 2×原高−现高，渲染出来正好回到原高', () => {
    // 实机量过：313 → 309，设 317 之后渲染回 313，同一列的另一组 318 → 314
    expect(splitHeightFix(313, 309)).toBe(317)
    expect(splitHeightFix(205.67, 200.67)).toBeCloseTo(210.67)
  })
})
