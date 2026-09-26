import { describe, expect, it, vi } from 'vitest'
import { startupCss, THEME_STARTUP_COMMAND } from '../src/startup-style.js'

/**
 * 开机外观样式：主题插件是可选的。要检查的是「总线上没这条命令就不调」——调了，总线就记一条
 * 「调用了不存在的命令」，没装主题插件的每个 home 每次开机都多这一条。
 */

type Reply = { ok: boolean; data?: unknown; error?: string }

function bus(commands: string[], reply: Reply) {
  return {
    list: () => commands.map((name) => ({ name, description: '', usage: '', plugin: '@godcreator/gwb-theme' })),
    run: vi.fn(async (_name: string, _args?: unknown) => reply),
  }
}

describe('startupCss', () => {
  it('命令不在：不调，回 undefined', async () => {
    const b = bus(['shell.env'], { ok: true, data: 'x' })
    const logError = vi.fn()
    expect(await startupCss(b, logError)).toBeUndefined()
    expect(b.run).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('命令在、回了一段 css：原样交出去', async () => {
    const b = bus([THEME_STARTUP_COMMAND], { ok: true, data: ':root { --font-sans: x }' })
    expect(await startupCss(b, vi.fn())).toBe(':root { --font-sans: x }')
    expect(b.run).toHaveBeenCalledWith(THEME_STARTUP_COMMAND)
  })

  it('命令在、回空白：用户没设置，当没有，不报错', async () => {
    const logError = vi.fn()
    expect(await startupCss(bus([THEME_STARTUP_COMMAND], { ok: true, data: '  \n' }), logError)).toBeUndefined()
    expect(logError).not.toHaveBeenCalled()
  })

  it('命令在但回失败、回的不是字符串：当没有，记一条 error 写明原因', async () => {
    const failed = vi.fn()
    expect(await startupCss(bus([THEME_STARTUP_COMMAND], { ok: false, error: '炸了' }), failed)).toBeUndefined()
    expect(String(failed.mock.calls[0]?.[0])).toContain('炸了')
    const notString = vi.fn()
    expect(await startupCss(bus([THEME_STARTUP_COMMAND], { ok: true, data: 42 }), notString)).toBeUndefined()
    expect(notString).toHaveBeenCalledTimes(1)
  })
})
