import { describe, expect, it } from 'vitest'
import {
  contentUpdateOf,
  isPluginPanel,
  isPreviewPanel,
  paneIdOf,
  paneKeyOf,
  paramsKeyOf,
  parsePaneContent,
  pluginKeyOf,
  pluginParamsIn,
  replaceParams,
  shellParamKeysIn,
  PLUGIN_COMPONENT,
  SHELL_PARAM_KEYS,
} from '../src/panels.js'

/**
 * **上报内容**（`setPaneContent`）：插件在窗格里原地换了内容，报一声「我现在装的是这个」。
 * 外壳只改这一份的面板 params——key 换成新的、给了 params 就整份换掉插件的那部分——不调 `retarget`、也不卸载后重新挂载。
 */
describe('parsePaneContent：插件上报的内容先校验形状', () => {
  it('只给 key 就行；params、title 给了就带上', () => {
    expect(parsePaneContent({ key: 'lib:b1' })).toEqual({ ok: true, content: { key: 'lib:b1' } })
    expect(parsePaneContent({ key: 'lib:b1', params: { root: 'b1' }, title: '第一块' })).toEqual({
      ok: true,
      content: { key: 'lib:b1', params: { root: 'b1' }, title: '第一块' },
    })
  })

  it('key 不是字符串、params 不是可序列化的平对象、title 不是字符串都拒，话里说清', () => {
    expect(parsePaneContent(null)).toMatchObject({ ok: false })
    expect(parsePaneContent({})).toMatchObject({ ok: false, error: expect.stringContaining('key') })
    expect(parsePaneContent({ key: 1 })).toMatchObject({ ok: false })
    expect(parsePaneContent({ key: 'a', params: [1] })).toMatchObject({ ok: false, error: expect.stringContaining('params') })
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(parsePaneContent({ key: 'a', params: cyclic })).toMatchObject({ ok: false })
    expect(parsePaneContent({ key: 'a', title: 3 })).toMatchObject({ ok: false, error: expect.stringContaining('title') })
  })
})

describe('contentUpdateOf：交给 dockview updateParameters 的那份', () => {
  const prev = {
    pluginKey: '@x/note',
    entryId: 'home:note',
    paneId: 'reader',
    icon: 'book',
    key: 'lib:a',
    preview: true,
    root: 'a',
    scroll: 120,
  }

  it('只给 key：只换 key，插件的那部分一个不动，预览状态不动', () => {
    expect(contentUpdateOf(prev, { key: 'lib:b' })).toEqual({ update: { key: 'lib:b' } })
  })

  it('给了 params：整份换掉插件的那部分（旧的多出来的键写 undefined 删掉），外壳那几个键与 preview 不动', () => {
    const { update } = contentUpdateOf(prev, { key: 'lib:b', params: { root: 'b' } })
    expect(update).toEqual({ key: 'lib:b', root: 'b', scroll: undefined })
    // 经 dockview 合并之后就是这一份
    const merged = Object.fromEntries(
      Object.entries({ ...prev, ...update }).filter(([, v]) => v !== undefined),
    )
    expect(merged).toEqual({ ...prev, key: 'lib:b', root: 'b', scroll: undefined, preview: true })
    expect(pluginParamsIn(merged)).toEqual({ root: 'b' })
  })

  it('给了空 params：插件的那部分清空', () => {
    expect(contentUpdateOf(prev, { key: 'lib:b', params: {} }).update).toEqual({
      key: 'lib:b',
      root: undefined,
      scroll: undefined,
    })
  })

  it('params 里的保留键摘掉，而且告警——插件改不动这一份的身份，也改不动预览状态', () => {
    const { update, notice } = contentUpdateOf(prev, {
      key: 'lib:b',
      params: { root: 'b', entryId: '别人的', preview: false },
    })
    expect(update).toEqual({ key: 'lib:b', root: 'b', scroll: undefined })
    expect(notice).toMatch(/保留键/)
    expect(notice).toContain('entryId')
  })

  it('上一份里一个插件自己的键都没有也照样算', () => {
    expect(contentUpdateOf(undefined, { key: 'k', params: { a: 1 } }).update).toEqual({ key: 'k', a: 1 })
  })
})

/**
 * 「重载 UI」按钮出不出现，看的是激活窗格的 component，不是 id 前缀。
 * 调试入口 `__gwbDebug.openPanel({ id: 'example-probe', component: 'plugin', … })` 开出来的
 * 窗格 id 不带 `plugin:`，按前缀判会把它漏掉——从调试入口开的窗格反而用不上调试功能。
 */

describe('isPluginPanel：按 component 判，不看 id', () => {
  it('component 是插件窗格就算，id 叫什么都行', () => {
    expect(isPluginPanel({ view: { contentComponent: PLUGIN_COMPONENT } })).toBe(true)
  })

  it('导航窗格、别的 component 不算', () => {
    expect(isPluginPanel({ view: { contentComponent: 'nav' } })).toBe(false)
    expect(isPluginPanel({ view: { contentComponent: 'settings' } })).toBe(false)
  })

  it('没有激活窗格、形状缺失，一律 false', () => {
    expect(isPluginPanel(undefined)).toBe(false)
    expect(isPluginPanel(null)).toBe(false)
    expect(isPluginPanel({})).toBe(false)
    expect(isPluginPanel({ view: {} })).toBe(false)
  })

  it('COMPONENTS 表里插件窗格那个键就是这个常量（外壳自己开的窗格与调试入口开的窗格同一个判据）', () => {
    expect(PLUGIN_COMPONENT).toBe('plugin')
  })
})

/**
 * 一个窗格背后是哪个插件，认的是 `params.pluginKey`（完整包名，跟条目视图的 pkg 同一个
 * 字符串）。插件卸载后该关哪几个窗格全靠它对应。
 */
describe('pluginKeyOf：认 params.pluginKey，认不出回空串', () => {
  it('插件窗格回它的包名', () => {
    const panel = { view: { contentComponent: PLUGIN_COMPONENT }, params: { pluginKey: '@godcreator/echo' } }
    expect(pluginKeyOf(panel)).toBe('@godcreator/echo')
  })

  it('不是插件窗格的一律空串——导航窗格的 params 里就算写了这一项也不算', () => {
    expect(pluginKeyOf({ view: { contentComponent: 'nav' }, params: { pluginKey: 'x' } })).toBe('')
  })

  it('插件窗格但 params 缺项、类型不对、整个没有：一律空串', () => {
    expect(pluginKeyOf({ view: { contentComponent: PLUGIN_COMPONENT } })).toBe('')
    expect(pluginKeyOf({ view: { contentComponent: PLUGIN_COMPONENT }, params: {} })).toBe('')
    expect(pluginKeyOf({ view: { contentComponent: PLUGIN_COMPONENT }, params: { pluginKey: 42 } })).toBe('')
  })

  it('没有面板一律空串', () => {
    expect(pluginKeyOf(null)).toBe('')
    expect(pluginKeyOf(undefined)).toBe('')
  })
})

/**
 * 一份面板 params 装两部分：外壳的三个识别字段（加图标）与插件开这一份时传的那些键。
 * 这两个函数就是那条分界线——放进面板前摘一次，交给插件前再摘一次。
 */
describe('保留键：外壳的那部分与插件的那部分的分界', () => {
  it('名单是三个识别字段、图标，加上内容身份那两样', () => {
    expect([...SHELL_PARAM_KEYS]).toEqual(['pluginKey', 'entryId', 'paneId', 'icon', 'key', 'preview'])
  })

  it('插件的那部分摘掉保留键，剩下的原样留着', () => {
    expect(
      pluginParamsIn({
        pluginKey: '@x/x',
        entryId: 'echo',
        paneId: 'main',
        icon: 'flask',
        key: 'a',
        preview: true,
        file: 'a.md',
        line: 3,
      }),
    ).toEqual({ file: 'a.md', line: 3 })
  })

  it('值是什么形状都不动它——只按键名摘，不碰值', () => {
    const nested = { where: { file: 'a.md', at: [1, 2] }, open: false, none: null }
    expect(pluginParamsIn(nested)).toEqual(nested)
  })

  it('一个键都不剩回 undefined，不回空对象——插件那头就能拿「没有」当「没给参数」', () => {
    expect(pluginParamsIn(undefined)).toBeUndefined()
    expect(pluginParamsIn({})).toBeUndefined()
    expect(pluginParamsIn({ pluginKey: '@x/x', entryId: 'echo', paneId: 'main' })).toBeUndefined()
  })

  it('用了哪几个保留键说得出名字——摘掉要告警，不静默', () => {
    expect(shellParamKeysIn({ entryId: '别人的', file: 'a.md' })).toEqual(['entryId'])
    expect(shellParamKeysIn({ paneId: 'x', icon: 'y', file: 'a.md' })).toEqual(['paneId', 'icon'])
  })

  it('没用保留键就不告警', () => {
    expect(shellParamKeysIn(undefined)).toEqual([])
    expect(shellParamKeysIn({ file: 'a.md' })).toEqual([])
  })
})

/**
 * 这个窗格装的是什么、是不是预览窗格：两样都存在面板 params 里，所以它们随布局保存——
 * 重载之后外壳照旧认得出哪个窗格装着什么、哪个是预览窗格，不用另存一份记录。
 */
describe('paneIdOf / paneKeyOf / isPreviewPanel：一个窗格的身份', () => {
  const plugin = (params: Record<string, unknown>) => ({ view: { contentComponent: PLUGIN_COMPONENT }, params })

  it('paneIdOf 认 params.paneId，认不出回空串', () => {
    expect(paneIdOf(plugin({ paneId: 'reader' }))).toBe('reader')
    expect(paneIdOf(plugin({}))).toBe('')
    expect(paneIdOf({ view: { contentComponent: 'nav' }, params: { paneId: 'reader' } })).toBe('')
  })

  it('paneKeyOf 认 params.key；**没给过就是空串，而空串是个正当的身份**', () => {
    expect(paneKeyOf(plugin({ key: 'blk-1' }))).toBe('blk-1')
    expect(paneKeyOf(plugin({ key: '' }))).toBe('')
    // 默认布局打开的那一份身上没有 key——它跟「插件不给 key 开的那一份」是同一个窗格
    expect(paneKeyOf(plugin({}))).toBe('')
    expect(paneKeyOf(plugin({ key: 42 }))).toBe('')
  })

  it('isPreviewPanel 判的是 === true：正式窗格身上没有这个键，不是 false', () => {
    expect(isPreviewPanel(plugin({ preview: true }))).toBe(true)
    expect(isPreviewPanel(plugin({}))).toBe(false)
    expect(isPreviewPanel(plugin({ preview: false }))).toBe(false)
    expect(isPreviewPanel(plugin({ preview: 'true' }))).toBe(false)
    expect(isPreviewPanel(null)).toBe(false)
  })
})

/**
 * **dockview 的 `updateParameters` 是合并不是替换**：面板那头做的是 `{ …旧, …新 }`，
 * 只有值写成 `undefined` 的键才删。原地换一个窗格的内容时不补这一步，上一份的参数会留在
 * 这个窗格里随布局保存——而现象只是「插件收到了一个它这一轮没传过的参数」。
 */
describe('replaceParams：把合并变成整份替换', () => {
  it('旧那份里多出来的键显式写成 undefined', () => {
    expect(replaceParams({ a: 1, stale: 'x' }, { a: 2 })).toEqual({ a: 2, stale: undefined })
  })

  it('新那份的值原样写上，同名的不用标成删除', () => {
    expect(replaceParams({ root: 'a' }, { root: 'b' })).toEqual({ root: 'b' })
  })

  it('新那份里多出来的键照常加进去，不用标成删除', () => {
    expect(replaceParams({ a: 1 }, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('没有旧那份就是原样回新的', () => {
    expect(replaceParams(undefined, { a: 1 })).toEqual({ a: 1 })
  })
})

/**
 * 「这一份的参数换了没有」拿它比。面板 params 每轮渲染都摘出一个新对象，按引用比等于
 * 每轮都算换了；而 params 本来就要求可 JSON 序列化，所以序列化得出来。
 */
describe('paramsKeyOf：稳定序列化', () => {
  it('同样的内容算出同一个键——**键先排序**，跟写的顺序无关', () => {
    expect(paramsKeyOf({ a: 1, b: 2 })).toBe(paramsKeyOf({ b: 2, a: 1 }))
  })

  it('内容不一样就不一样', () => {
    expect(paramsKeyOf({ root: 'a' })).not.toBe(paramsKeyOf({ root: 'b' }))
    expect(paramsKeyOf({ root: 'a' })).not.toBe(paramsKeyOf({ root: 'a', at: 1 }))
  })

  it('嵌套的值也算进去', () => {
    expect(paramsKeyOf({ where: { file: 'a.md' } })).not.toBe(paramsKeyOf({ where: { file: 'b.md' } }))
  })

  it('没有参数回空串，而且跟空表分得开——「没给」与「给了个空的」是两回事', () => {
    expect(paramsKeyOf(undefined)).toBe('')
    expect(paramsKeyOf({})).not.toBe('')
  })
})
