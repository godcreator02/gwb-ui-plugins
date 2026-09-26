import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { fetchPanes, fetchPlugins } from '../src/client/panes.js'
import type { HostBridge } from '../src/client/types.js'

/**
 * 取注册表失败不能当「一个窗格都没注册」：启动器会显示「还没有插件注册窗格」，人以为是插件没装。
 * 取插件名表失败可以退回包名当组名，但要记一条 error 写明原因。
 */

function hostReplying(reply: unknown): HostBridge {
  return { call: () => Promise.resolve(reply) }
}

const failingHost: HostBridge = { call: () => Promise.reject(new Error('管道断了')) }

let errorSpy: MockInstance<typeof console.error>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('fetchPanes', () => {
  it('取到的空表就是空表', async () => {
    expect(await fetchPanes(hostReplying({ ok: true, data: [] }))).toEqual([])
  })

  it('回失败或回的不是表：抛错，原因带上回执', async () => {
    await expect(fetchPanes(hostReplying({ ok: false, error: '炸了' }))).rejects.toThrow('炸了')
    await expect(fetchPanes(hostReplying({ ok: true, data: 'oops' }))).rejects.toThrow('shell.panes')
  })

  it('IPC 调不通：抛错，原因带上报错', async () => {
    await expect(fetchPanes(failingHost)).rejects.toThrow('管道断了')
  })
})

describe('fetchPlugins', () => {
  it('取到了原样交出', async () => {
    const rows = [{ entryId: 'home:a', pkg: 'a', title: '甲' }]
    expect(await fetchPlugins(hostReplying({ ok: true, data: rows }))).toEqual(rows)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('回失败、调不通：回空表（组名退回包名），并记一条 error 写明原因', async () => {
    expect(await fetchPlugins(hostReplying({ ok: false, error: '炸了' }))).toEqual([])
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('炸了')
    expect(await fetchPlugins(failingHost)).toEqual([])
    expect(String(errorSpy.mock.calls[1]?.[0])).toContain('管道断了')
  })
})
