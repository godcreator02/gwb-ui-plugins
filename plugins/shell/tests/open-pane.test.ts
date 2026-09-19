import { describe, expect, it } from 'vitest'
import {
  OPEN_PANE_EVENT,
  isOpenPaneAction,
  openPaneOptionsOf,
  openPaneSourceOf,
  parseOpenPaneArgs,
} from '../src/open-pane.js'

/**
 * 跨件开格的纯判断：事件口上认不认得出自己的记号、总线参数怎么认成一份合法载荷、
 * 事件载荷怎么挑回 openPane 的那几样。命令总线对外暴露，参数不能默认来自界面。
 */

describe('isOpenPaneAction', () => {
  it('记号对得上才认，null / 原始值 / 别件的事件都不认', () => {
    expect(isOpenPaneAction({ t: OPEN_PANE_EVENT, entryId: 'home:docs-site', paneId: 'view' })).toBe(true)
    expect(isOpenPaneAction(null)).toBe(false)
    expect(isOpenPaneAction('open')).toBe(false)
    expect(isOpenPaneAction({ t: 'gwb-docs-site', kind: 'view' })).toBe(false)
    expect(isOpenPaneAction({})).toBe(false)
  })
})

describe('parseOpenPaneArgs', () => {
  it('最小一份只要 entryId 与 paneId，拼出来的动作带上记号、不带没给的键', () => {
    const parsed = parseOpenPaneArgs({ entryId: 'home:docs-site', paneId: 'view' })
    expect(parsed).toEqual({ ok: true, action: { t: OPEN_PANE_EVENT, entryId: 'home:docs-site', paneId: 'view' } })
  })

  it('key / params / preview 给了就带上，preview 只有 true 才落进动作', () => {
    const parsed = parseOpenPaneArgs({
      entryId: 'home:docs-site',
      paneId: 'view',
      key: 'D:\\somedir',
      params: { dir: 'D:\\somedir' },
      preview: true,
    })
    expect(parsed).toEqual({
      ok: true,
      action: {
        t: OPEN_PANE_EVENT,
        entryId: 'home:docs-site',
        paneId: 'view',
        key: 'D:\\somedir',
        params: { dir: 'D:\\somedir' },
        preview: true,
      },
    })
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', preview: false })).toEqual({
      ok: true,
      action: { t: OPEN_PANE_EVENT, entryId: 'a', paneId: 'b' },
    })
  })

  it('entryId / paneId 缺一或空串就拒——注册表的键是二元组，光给 paneId 会撞名', () => {
    expect(parseOpenPaneArgs({ paneId: 'view' })).toEqual({
      ok: false,
      error: 'entryId 要是非空字符串（shell.panes 回的表里那条 entryId）',
    })
    expect(parseOpenPaneArgs({ entryId: 'home:x', paneId: '' })).toEqual({
      ok: false,
      error: 'paneId 要是非空字符串（件 registerPane 时报的窗格 id）',
    })
  })

  it('不是对象（null / 数组 / 原始值）就拒', () => {
    expect(parseOpenPaneArgs(null)).toMatchObject({ ok: false })
    expect(parseOpenPaneArgs(['home:x', 'view'])).toMatchObject({ ok: false })
    expect(parseOpenPaneArgs('home:x')).toMatchObject({ ok: false })
  })

  it('key 不是字符串、params 不是平对象、preview 不是布尔都拒', () => {
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', key: 3 })).toMatchObject({ ok: false })
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', params: 'x' })).toMatchObject({ ok: false })
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', params: [1] })).toMatchObject({ ok: false })
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', preview: 'yes' })).toMatchObject({ ok: false })
  })

  it('from（来源窗格的实例 id）与 placement 给了就带上', () => {
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', from: 'plugin:home:x:main:2', placement: 'side' })).toEqual({
      ok: true,
      action: { t: OPEN_PANE_EVENT, entryId: 'a', paneId: 'b', from: 'plugin:home:x:main:2', placement: 'side' },
    })
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', placement: 'auto' })).toEqual({
      ok: true,
      action: { t: OPEN_PANE_EVENT, entryId: 'a', paneId: 'b', placement: 'auto' },
    })
  })

  it('from 不是非空字符串、placement 不是 auto / side 都拒', () => {
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', from: '' })).toMatchObject({ ok: false })
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', from: 3 })).toMatchObject({ ok: false })
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', placement: 'left' })).toMatchObject({ ok: false })
  })

  it('params 里循环引用过不了那道门——它跟着布局落盘，别让它写坏盘上那份', () => {
    const cyclic: Record<string, unknown> = { dir: 'x' }
    cyclic.self = cyclic
    expect(parseOpenPaneArgs({ entryId: 'a', paneId: 'b', params: cyclic })).toMatchObject({ ok: false })
  })
})

describe('openPaneOptionsOf：不假设发事件的那半先验过形状，键各挑各的', () => {
  it('齐全的载荷挑回四样', () => {
    expect(
      openPaneOptionsOf({
        t: OPEN_PANE_EVENT,
        entryId: 'a',
        paneId: 'b',
        key: 'k',
        params: { x: 1 },
        preview: true,
        placement: 'side',
      }),
    ).toEqual({ key: 'k', params: { x: 1 }, preview: true, placement: 'side' })
  })

  it('挑不走的当没给——key 非串、params 非平对象、preview 非 true、placement 认不出一律不带', () => {
    expect(
      openPaneOptionsOf({ t: OPEN_PANE_EVENT, entryId: 'a', paneId: 'b', key: 3, params: 'x', preview: 1, placement: 'up' }),
    ).toEqual({})
    expect(openPaneOptionsOf({ t: OPEN_PANE_EVENT, entryId: 'a', paneId: 'b', preview: false })).toEqual({})
  })
})

describe('openPaneSourceOf：来源窗格的实例 id', () => {
  it('非空字符串才认，别的当没有来源', () => {
    expect(openPaneSourceOf({ t: OPEN_PANE_EVENT, from: 'plugin:home:x:main' })).toBe('plugin:home:x:main')
    expect(openPaneSourceOf({ t: OPEN_PANE_EVENT, from: '' })).toBeUndefined()
    expect(openPaneSourceOf({ t: OPEN_PANE_EVENT, from: 7 })).toBeUndefined()
    expect(openPaneSourceOf({ t: OPEN_PANE_EVENT })).toBeUndefined()
  })
})
