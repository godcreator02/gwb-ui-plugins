import { describe, expect, it, vi } from 'vitest'
import { startupCss, THEME_STARTUP_COMMAND } from '../src/startup-style.js'

/**
 * 开机外观样式：theme 是可选件。要钉住的是「总线上没这条命令就不调」——调了，总线就记一条
 * 「跑了条不存在的命令」，没装 theme 的每个 home 每次开机都带着它。
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
    expect(await startupCss(b)).toBeUndefined()
    expect(b.run).not.toHaveBeenCalled()
  })

  it('命令在、回了一段 css：原样交出去', async () => {
    const b = bus([THEME_STARTUP_COMMAND], { ok: true, data: ':root { --font-sans: x }' })
    expect(await startupCss(b)).toBe(':root { --font-sans: x }')
    expect(b.run).toHaveBeenCalledWith(THEME_STARTUP_COMMAND)
  })

  it('命令在但回失败、回空白、回的不是字符串：一律当没有', async () => {
    for (const reply of [{ ok: false, error: '炸了' }, { ok: true, data: '  \n' }, { ok: true, data: 42 }]) {
      expect(await startupCss(bus([THEME_STARTUP_COMMAND], reply))).toBeUndefined()
    }
  })
})
