import { describe, expect, it, vi } from 'vitest'
import { createStartupStyleSlot } from '../src/startup-style.js'

/** 启动时的用户外观样式：主题插件是可选的，登记了才有；外壳只收一份 */

const theme = { entryId: 'home:theme', pkg: '@godcreator/gwb-theme' }
const other = { entryId: 'home:other', pkg: '@t/other' }

describe('启动样式', () => {
  it('没人登记：回 undefined，不报错', () => {
    const logError = vi.fn()
    expect(createStartupStyleSlot().css(logError)).toBeUndefined()
    expect(logError).not.toHaveBeenCalled()
  })

  it('登记了：每次现读，原样交出去；空白当没有', () => {
    const slot = createStartupStyleSlot()
    let css = ':root { --font-sans: x }'
    slot.register(theme, () => css)
    expect(slot.css(vi.fn())).toBe(':root { --font-sans: x }')
    css = '  \n'
    const logError = vi.fn()
    expect(slot.css(logError)).toBeUndefined()
    expect(logError).not.toHaveBeenCalled()
  })

  it('读的时候抛错：当没有，记一条 error 写明是谁登记的、原因', () => {
    const slot = createStartupStyleSlot()
    slot.register(theme, () => {
      throw new Error('炸了')
    })
    const logError = vi.fn()
    expect(slot.css(logError)).toBeUndefined()
    expect(String(logError.mock.calls[0]?.[0])).toContain('@godcreator/gwb-theme')
    expect(String(logError.mock.calls[0]?.[0])).toContain('炸了')
  })

  it('只收一份：第二个登记的抛错；注销后能重新登记，旧的注销函数不撤新的', () => {
    const slot = createStartupStyleSlot()
    const unregister = slot.register(theme, () => 'a{}')
    expect(() => slot.register(other, () => 'b{}')).toThrow('外壳只收一份')
    unregister()
    expect(slot.css(vi.fn())).toBeUndefined()
    slot.register(other, () => 'b{}')
    unregister()
    expect(slot.css(vi.fn())).toBe('b{}')
  })
})
