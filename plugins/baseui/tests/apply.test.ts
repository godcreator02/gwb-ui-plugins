import { Context } from 'cordis'
import { describe, expect, it } from 'vitest'
import * as baseui from '../src/index.js'

import { QUERY_USAGE } from '../src/log-query/query.js'

/**
 * 基础界面插件的 apply：真实的 cordis 根上下文，外壳与命令总线用替身；按现在的行为检查
 * 报名字、日志窗格总是注册、装了插件管理才注册插件管理窗格、有命令总线才登记 logger.query、服务卸载时跟着注销。
 */

/** 只记登记与注销的命令总线替身 */
function fakeCommandBus() {
  const definitions = new Map<string, Record<string, unknown>>()
  return {
    list: () => [...definitions.values()],
    register(def: Record<string, unknown>) {
      definitions.set(String(def['name']), def)
      return () => void definitions.delete(String(def['name']))
    },
  }
}

const fakeKernel = { dataDir: 'unused-home', version: 'test', emit: () => {}, setShell: () => () => {} }

function fakeShell() {
  const panes = new Map<string, Record<string, unknown>>()
  const described: Record<string, unknown>[] = []
  return {
    panes,
    described,
    registerPane(spec: Record<string, unknown>) {
      panes.set(String(spec['id']), spec)
      return () => {
        panes.delete(String(spec['id']))
      }
    },
    describeSelf(info: Record<string, unknown>) {
      described.push(info)
      return () => undefined
    },
  }
}

async function bootBaseui(services: { pluginManager: boolean }) {
  const root = new Context()
  const shell = fakeShell()
  root.provide('gwbShell', shell)
  if (services.pluginManager) root.provide('gwbPluginManager', {})
  await root.plugin(baseui)
  return { root, shell }
}

describe('基础界面插件 apply', () => {
  it('报一次自己的名字', async () => {
    const { shell } = await bootBaseui({ pluginManager: false })
    expect(shell.described).toEqual([{ title: '基础界面', icon: 'layout-grid' }])
  })

  it('没有插件管理服务：只注册日志窗格，地址指向同目录的 client.js 与 style.css', async () => {
    const { shell } = await bootBaseui({ pluginManager: false })
    expect([...shell.panes.keys()]).toEqual(['logger'])
    const logger = shell.panes.get('logger')!
    expect(logger).toMatchObject({ id: 'logger', title: '日志', icon: 'scroll-text' })
    expect(String(logger['client'])).toMatch(/\/client\.js$/)
    expect(String(logger['style'])).toMatch(/\/style\.css$/)
  })

  it('有插件管理服务：两个窗格都注册', async () => {
    const { shell } = await bootBaseui({ pluginManager: true })
    expect([...shell.panes.keys()].sort()).toEqual(['logger', 'plugin-manager'])
    expect(shell.panes.get('plugin-manager')).toMatchObject({ title: '插件管理', icon: 'puzzle' })
  })

  it('插件管理后装上时补注册，卸载时插件管理窗格注销、日志窗格留着', async () => {
    const { root, shell } = await bootBaseui({ pluginManager: false })
    const pluginManagerFiber = root.plugin({
      name: 'fake-plugin-manager',
      apply: (ctx: Context) => {
        ctx.provide('gwbPluginManager', {})
      },
    })
    await pluginManagerFiber
    expect([...shell.panes.keys()].sort()).toEqual(['logger', 'plugin-manager'])
    await pluginManagerFiber.dispose()
    expect([...shell.panes.keys()]).toEqual(['logger'])
  })

  it('插件卸载时日志窗格跟着注销', async () => {
    const root = new Context()
    const shell = fakeShell()
    root.provide('gwbShell', shell)
    const baseuiFiber = root.plugin(baseui)
    await baseuiFiber
    expect([...shell.panes.keys()]).toEqual(['logger'])
    await baseuiFiber.dispose()
    expect([...shell.panes.keys()]).toEqual([])
  })

  it('有命令总线：登记 logger.query（effect 是 read，plugin 不写、由命令总线取），插件卸载时注销', async () => {
    const root = new Context()
    const bus = fakeCommandBus()
    root.provide('gwbShell', fakeShell())
    root.provide('gwbKernel', fakeKernel)
    root.provide('gwbCommands', bus)
    const baseuiFiber = root.plugin(baseui)
    await baseuiFiber
    expect(bus.list()).toEqual([
      {
        name: 'logger.query',
        description: '查内核写的日志文件 gwb.log（含轮转出的 gwb.log.1）：可按级别、logger 名、子串筛，只取最近几条，或只取某个位置之后新写的',
        usage: QUERY_USAGE,
        effect: 'read',
      },
    ])
    await baseuiFiber.dispose()
    expect(bus.list()).toEqual([])
  })

  it('没有命令总线：不登记 logger.query，窗格照常；命令总线后装上时补登记，它卸载后不留登记', async () => {
    const root = new Context()
    const shell = fakeShell()
    const bus = fakeCommandBus()
    root.provide('gwbShell', shell)
    root.provide('gwbKernel', fakeKernel)
    await root.plugin(baseui)
    expect([...shell.panes.keys()]).toEqual(['logger'])
    expect(bus.list()).toEqual([])

    const commandBusFiber = root.plugin({
      name: 'fake-command-bus',
      apply: (ctx: Context) => {
        ctx.provide('gwbCommands', bus)
      },
    })
    await commandBusFiber
    expect(bus.list().map((def) => def['name'])).toEqual(['logger.query'])
    await commandBusFiber.dispose()
    expect(bus.list()).toEqual([])
    expect([...shell.panes.keys()]).toEqual(['logger'])
  })
})
