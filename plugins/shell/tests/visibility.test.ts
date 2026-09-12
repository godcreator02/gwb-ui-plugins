import { describe, expect, it, vi } from 'vitest'
import { createVisibilityHub } from '../src/client/visibility.js'

/**
 * 可见性枢纽：通知按桌面分发、注册即回一次当下值、退订摘干净、听众抛异常不连坐。
 * 这是件协作式降级（shell.onVisibility）能成立的那台小机器——它坏了件收不到切换，
 * 症状是「切走了还在烧」，所以每一条都钉住。
 */

describe('VisibilityHub', () => {
  it('注册即回一次当下值；还没通知过的桌面按「可见」起（井只在切到时才挂）', () => {
    const hub = createVisibilityHub()
    const cb = vi.fn()
    hub.subscribe('d1', cb)
    expect(cb.mock.calls).toEqual([[true]])
  })

  it('通知到达；之后注册的听众拿到的是最近一次的值', () => {
    const hub = createVisibilityHub()
    hub.notify('d2', false)
    const cb = vi.fn()
    hub.subscribe('d2', cb)
    expect(cb.mock.calls).toEqual([[false]])
  })

  it('通知按桌面分发：别的桌面收不到', () => {
    const hub = createVisibilityHub()
    const cb1 = vi.fn()
    hub.subscribe('d1', cb1)
    cb1.mockClear()
    hub.notify('d2', false)
    expect(cb1).not.toHaveBeenCalled()
  })

  it('退订之后不再收；摘两遍不炸', () => {
    const hub = createVisibilityHub()
    const cb = vi.fn()
    const off = hub.subscribe('d1', cb)
    cb.mockClear()
    off()
    off()
    hub.notify('d1', false)
    expect(cb).not.toHaveBeenCalled()
  })

  it('听众抛异常按听众隔离：一个炸了，同桌面别的听众照收（通知与注册即回两条路都是）', () => {
    const hub = createVisibilityHub()
    const err = vi.fn(() => {
      throw new Error('写坏了')
    })
    const ok = vi.fn()
    // 注册即回那一条：err 抛了不影响 ok 拿到 true
    hub.subscribe('d3', err)
    hub.subscribe('d3', ok)
    expect(ok.mock.calls).toEqual([[true]])
    err.mockClear()
    ok.mockClear()
    hub.notify('d3', false)
    expect(ok.mock.calls).toEqual([[false]])
  })

  it('听众在回调里退订自己是正当用法：不炸、退订之后不再收', () => {
    const hub = createVisibilityHub()
    const seen: boolean[] = []
    let off: () => void = () => {}
    off = hub.subscribe('d4', (visible) => {
      seen.push(visible)
      off()
    })
    // 注册即回那一次（true）时 off 还是初值空函数，退订发生在下一条
    seen.length = 0
    hub.notify('d4', false)
    hub.notify('d4', true)
    expect(seen).toEqual([false])
  })

  it('两份枢纽互不相通：工厂造的是各自的账', () => {
    const a = createVisibilityHub()
    const b = createVisibilityHub()
    const cb = vi.fn()
    a.subscribe('d1', cb)
    cb.mockClear()
    b.notify('d1', false)
    expect(cb).not.toHaveBeenCalled()
  })
})
