import { Context } from 'cordis'
import type { Message } from 'cordis'
import { describe, expect, it } from 'vitest'
import * as theme from '../src/index.js'

/**
 * 主题插件的 apply：真实的 cordis 根上下文，设置、命令总线、外壳用替身；
 * 按现在的行为检查三项设置的声明、三条命令、外壳在不在时的窗格注册。
 */

type Handler = (args?: unknown) => unknown

function fakeSettings() {
  const defined: { key: string; default: unknown }[] = []
  const values = new Map<string, unknown>()
  const writes: [string, unknown][] = []
  return {
    defined,
    values,
    writes,
    define(def: { key: string; default: unknown }) {
      defined.push(def)
    },
    get(key: string): unknown {
      return values.has(key) ? values.get(key) : defined.find((def) => def.key === key)?.default
    },
    set(key: string, value: unknown): Promise<void> {
      writes.push([key, value])
      values.set(key, value)
      return Promise.resolve()
    },
  }
}

function fakeCommands() {
  const handlers = new Map<string, Handler>()
  const defs: { name: string; plugin: string }[] = []
  return {
    handlers,
    defs,
    register(def: { name: string; plugin: string }, handler: Handler) {
      handlers.set(def.name, handler)
      defs.push(def)
      return () => {
        handlers.delete(def.name)
      }
    },
  }
}

function fakeShell() {
  const panes: Record<string, unknown>[] = []
  const described: Record<string, unknown>[] = []
  return {
    panes,
    described,
    registerPane(spec: Record<string, unknown>) {
      panes.push(spec)
      return () => undefined
    },
    describeSelf(info: Record<string, unknown>) {
      described.push(info)
      return () => undefined
    },
  }
}

async function bootTheme(options: { withShell: boolean }) {
  const root = new Context()
  const logs: Message[] = []
  root.logger.exporter({ export: (message) => void logs.push(message) })
  const settings = fakeSettings()
  const commands = fakeCommands()
  const shell = fakeShell()
  root.provide('gwbSettings', settings)
  root.provide('gwbCommands', commands)
  if (options.withShell) root.provide('gwbShell', shell)
  await root.plugin(theme)
  const call = async (name: string, args?: unknown): Promise<unknown> => {
    const handler = commands.handlers.get(name)
    if (handler === undefined) throw new Error(`没注册 ${name}`)
    return await handler(args)
  }
  return { settings, commands, shell, logs, call }
}

describe('主题插件 apply', () => {
  it('声明三项 home 级设置，缺省都是空串', async () => {
    const { settings } = await bootTheme({ withShell: false })
    expect(settings.defined.map((def) => [def.key, def.default])).toEqual([
      ['font-sans', ''],
      ['font-mono', ''],
      ['custom-css', ''],
    ])
  })

  it('登记三条命令，plugin 写包名', async () => {
    const { commands } = await bootTheme({ withShell: false })
    expect(commands.defs.map((def) => [def.name, def.plugin])).toEqual([
      ['theme.startupCss', '@godcreator/gwb-theme'],
      ['theme.values', '@godcreator/gwb-theme'],
      ['theme.save', '@godcreator/gwb-theme'],
    ])
  })

  it('theme.values 回 kebab 形的三项现值；theme.startupCss 按现值拼启动样式', async () => {
    const { settings, call } = await bootTheme({ withShell: false })
    expect(await call('theme.values')).toEqual({ 'font-sans': '', 'font-mono': '', 'custom-css': '' })
    expect(await call('theme.startupCss')).toBe('')
    settings.values.set('font-mono', 'Sarasa Mono')
    settings.values.set('custom-css', 'body { color: red }')
    settings.values.set('font-sans', 42)
    expect(await call('theme.values')).toEqual({ 'font-sans': '', 'font-mono': 'Sarasa Mono', 'custom-css': 'body { color: red }' })
    expect(await call('theme.startupCss')).toBe(':root {\n  --gwb-font-mono: Sarasa Mono;\n}\n\nbody { color: red }')
  })

  it('theme.save 逐项写三项，回 ok；空串照写（恢复默认）', async () => {
    const { settings, call } = await bootTheme({ withShell: false })
    expect(await call('theme.save', { 'font-sans': 'Inter', 'font-mono': '', 'custom-css': ':root{}' })).toEqual({ ok: true })
    expect(settings.writes).toEqual([
      ['font-sans', 'Inter'],
      ['font-mono', ''],
      ['custom-css', ':root{}'],
    ])
  })

  it('theme.save 参数不对就回 ok:false 说清错在哪，一项都不写', async () => {
    const { settings, call } = await bootTheme({ withShell: false })
    const rejected = async (args: unknown): Promise<string> => {
      const reply = (await call('theme.save', args)) as { ok: boolean; error?: string }
      expect(reply.ok).toBe(false)
      return reply.error ?? ''
    }
    expect(await rejected(undefined)).toContain('要是对象')
    expect(await rejected(['Inter'])).toContain('要是对象')
    expect(await rejected({ 'font-sans': 'Inter', 'font-mono': '' })).toContain('缺键 "custom-css"')
    expect(await rejected({ 'font-sans': 'Inter', 'font-mono': 7, 'custom-css': '' })).toContain('"font-mono" 要是字符串')
    expect(await rejected({ 'font-sans': '', 'font-mono': '', 'custom-css': '', fontSans: 'Inter' })).toContain('认不出这些键：fontSans')
    expect(settings.writes).toEqual([])
  })

  it('没有外壳：不注册窗格，照常加载', async () => {
    const { shell, logs } = await bootTheme({ withShell: false })
    expect(shell.panes).toEqual([])
    expect(logs.some((message) => message.args.map(String).join(' ').includes('外观就绪'))).toBe(true)
  })

  it('有外壳：注册「外观」窗格并报名字，地址指向同目录的 client.js 与 style.css', async () => {
    const { shell } = await bootTheme({ withShell: true })
    expect(shell.panes).toHaveLength(1)
    expect(shell.panes[0]).toMatchObject({ id: 'appearance', title: '外观', icon: 'palette' })
    expect(String(shell.panes[0]!['client'])).toMatch(/\/client\.js$/)
    expect(String(shell.panes[0]!['style'])).toMatch(/\/style\.css$/)
    expect(shell.described).toEqual([{ title: '外观', icon: 'palette' }])
  })
})
