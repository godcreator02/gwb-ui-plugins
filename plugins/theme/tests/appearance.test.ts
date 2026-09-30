import { createElement, type FunctionComponent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { fieldValuesOf } from '../src/client/values.js'

/**
 * 「外观」窗格在取到当前值之前不许保存：保存是一次写齐三项，这时输入框里还是初始的空串，
 * 一点保存就把三项设置全覆盖成空串。取失败时同理，而且要把原因显示出来。
 */

type HostBridge = { call(command: string, args?: unknown): Promise<unknown> }

/** 仓根 tsconfig 收编 tests 但没开 jsx，静态 import .tsx 会报 TS6142；路径放进变量，由 vitest 自己编译 */
const clientEntry = '../src/client/index.tsx'
const { Appearance } = (await import(/* @vite-ignore */ clientEntry)) as { Appearance: FunctionComponent<{ host: HostBridge }> }

describe('外观窗格：取到当前值之前不许保存', () => {
  it('首次渲染（还没取到 theme.values）时保存按钮是禁用的', () => {
    const neverAnswers: HostBridge = { call: () => new Promise<unknown>(() => undefined) }
    const html = renderToStaticMarkup(createElement(Appearance, { host: neverAnswers }))
    // 认 disabled 属性本身：按钮的类名里也有 `disabled:` 变体，只找 disabled 这个词会误中
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>保存<\/button>/)
  })
})

describe('fieldValuesOf：theme.values 回执形状不对就报错，不当成空值', () => {
  it('三项都是字符串时照收', () => {
    expect(fieldValuesOf({ 'font-sans': 'Inter', 'font-mono': '', 'custom-css': 'body{}' })).toEqual({
      fontSans: 'Inter',
      fontMono: '',
      customCss: 'body{}',
    })
  })

  it('某一项不是字符串就抛错，错误里写明是哪一项', () => {
    expect(() => fieldValuesOf({ 'font-sans': 42, 'font-mono': '', 'custom-css': '' })).toThrow(/font-sans/)
    expect(() => fieldValuesOf({ 'font-mono': '', 'custom-css': '' })).toThrow(/font-sans/)
  })

  it('data 不是对象就抛错', () => {
    expect(() => fieldValuesOf(null)).toThrow()
    expect(() => fieldValuesOf(['Inter'])).toThrow()
  })
})
