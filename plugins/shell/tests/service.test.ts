import { Context } from 'cordis'
import type { Message, Plugin } from 'cordis'
import type { GwbCommandDef, GwbCommands } from '@godcreator/gwb-commands'
import { describe, expect, it, vi } from 'vitest'
import GwbShell, { type GwbShellApi } from '../src/index.js'
import { LAYOUT_VERSION, type LayoutDoc } from '../src/layout.js'

/**
 * 外壳 node 侧服务：真实的 cordis 根上下文，内核、命令总线、数据插件用替身；
 * 按现在的行为检查注册表、调用方身份、17 条命令与转发给页面的事件。
 * 令牌表地址经包名解析、要有构建产物，这里替换掉 createRequire 的 resolve，测试不依赖构建。
 */

vi.mock('node:module', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:module')>()
  return {
    createRequire: (url: string | URL) => {
      const realRequire = original.createRequire(url)
      const fakeResolve = (specifier: string): string =>
        specifier === '@godcreator/gwb-shell/theme.css' ? '/fake/gwb-shell/dist/theme.css' : realRequire.resolve(specifier)
      return Object.assign((id: string): unknown => realRequire(id), realRequire, { resolve: fakeResolve })
    },
  }
})

type Handler = (args?: unknown) => unknown

function fakeCommandBus(): GwbCommands & { handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>()
  const defs = new Map<string, Required<GwbCommandDef>>()
  return {
    handlers,
    register(def, handler) {
      handlers.set(def.name, handler)
      defs.set(def.name, { name: def.name, description: def.description ?? '', usage: def.usage ?? '', plugin: def.plugin })
      return () => {
        handlers.delete(def.name)
        defs.delete(def.name)
      }
    },
    list() {
      return [...defs.values()]
    },
    async run(name, args) {
      const handler = handlers.get(name)
      if (handler === undefined) return { ok: false, error: `没有这条命令：${name}` }
      const result = await handler(args)
      if (result !== null && typeof result === 'object' && 'ok' in result) return result as { ok: boolean }
      return { ok: true, data: result }
    },
  }
}

function fakeData(initial?: unknown) {
  const docs = new Map<string, unknown>()
  if (initial !== undefined) docs.set('layout', initial)
  return {
    docs,
    readDoc: (name: string) => Promise.resolve(docs.get(name)),
    writeDoc: (name: string, value: unknown) => {
      docs.set(name, value)
      return Promise.resolve()
    },
  }
}

async function bootShell(options: { layout?: unknown } = {}) {
  const root = new Context()
  const logs: Message[] = []
  root.logger.exporter({ export: (message) => void logs.push(message) })
  const emitted: unknown[] = []
  const shellEntries: (string | null)[] = []
  root.provide('gwbKernel', {
    dataDir: 'D:/fake-home',
    version: '9.9.9',
    emit: (payload: unknown) => void emitted.push(payload),
    setShell: (url: string) => {
      shellEntries.push(url)
      return () => void shellEntries.push(null)
    },
  })
  const bus = fakeCommandBus()
  root.provide('gwbCommands', bus)
  const data = fakeData(options.layout)
  root.provide('gwbData', data)
  const shellFiber = root.plugin(GwbShell as unknown as Plugin)
  await shellFiber
  const call = async (name: string, args?: unknown): Promise<unknown> => {
    const handler = bus.handlers.get(name)
    if (handler === undefined) throw new Error(`没注册 ${name}`)
    return await handler(args)
  }
  return { root, logs, emitted, shellEntries, bus, data, call, shellFiber }
}

async function callerShell(root: Context, entry: { id: string; pkg: string } | null) {
  let shell: GwbShellApi | undefined
  const fiber = root.plugin({
    name: 'caller',
    inject: ['gwbShell'],
    apply: (ctx: Context) => {
      if (entry !== null) {
        ;(ctx.fiber as unknown as { entry: unknown }).entry = { id: entry.id, options: { name: entry.pkg } }
      }
      shell = ctx.gwbShell
    },
  })
  await fiber
  if (shell === undefined) throw new Error('调用方没拿到 gwbShell')
  return { shell, fiber }
}

const textsOf = (logs: Message[], type: string): string[] => logs.filter((m) => m.type === type).map((m) => m.args.map(String).join(' '))

const hello = { id: 'home:hello', pkg: '@t/gwb-hello' }

function layoutDoc(desktops: { id: string; name: string }[], active = desktops[0]!.id): LayoutDoc {
  return { v: LAYOUT_VERSION, active, desktops: desktops.map((d) => ({ ...d, layout: null })), saved: [] }
}

describe('外壳服务就绪', () => {
  it('把页面根要过来：setShell 收到本包 client.js 的地址，外壳卸载时撤销', async () => {
    const { shellEntries, shellFiber } = await bootShell()
    expect(shellEntries).toHaveLength(1)
    expect(shellEntries[0]).toMatch(/\/client\.js$/)
    await shellFiber.dispose()
    expect(shellEntries.at(-1)).toBeNull()
  })

  it('登记全部 17 条命令，plugin 都写包名', async () => {
    const { bus } = await bootShell()
    expect(bus.list().map((c) => c.name).sort()).toEqual(
      [
        'shell.panes',
        'shell.plugins',
        'shell.layout.get',
        'shell.layout.save',
        'shell.env',
        'shell.reload',
        'shell.desktop.list',
        'shell.desktop.switch',
        'shell.desktop.new',
        'shell.desktop.rename',
        'shell.desktop.delete',
        'shell.openPane',
        'shell.pane.sync',
        'shell.pane.list',
        'shell.pane.focus',
        'shell.pane.send',
        'shell.pane.close',
      ].sort(),
    )
    expect(new Set(bus.list().map((c) => c.plugin))).toEqual(new Set(['@godcreator/gwb-shell']))
  })

  it('没有图标名单时写一条 error，登记时不再核对图标名', async () => {
    const { root, logs } = await bootShell()
    expect(textsOf(logs, 'error').some((t) => t.includes('pane-icons.json') && t.includes('不再核对图标名'))).toBe(true)
    const { shell } = await callerShell(root, hello)
    shell.registerPane({ id: 'main', title: '主', icon: 'NotKebab' })
    expect(textsOf(logs, 'warn').filter((t) => t.includes('NotKebab'))).toEqual([])
  })
})

describe('registerPane / describeSelf：身份从调用方的 fiber 上取', () => {
  it('窗格表带上调用方的 entryId 与 pkg，shell.panes 回同一张表，并写一条 info', async () => {
    const { root, call, logs } = await bootShell()
    const { shell } = await callerShell(root, hello)
    shell.registerPane({ id: 'main', title: '你好', kind: 'document' })
    const expected = [{ id: 'main', title: '你好', kind: 'document', entryId: 'home:hello', pkg: '@t/gwb-hello' }]
    expect(shell.panes()).toEqual(expected)
    expect(await call('shell.panes')).toEqual(expected)
    expect(textsOf(logs, 'info').some((t) => t.includes('窗格 main') && t.includes('文档窗格') && t.includes('@t/gwb-hello'))).toBe(true)
  })

  it('插件名表同理，shell.plugins 回它', async () => {
    const { root, call } = await bootShell()
    const { shell } = await callerShell(root, hello)
    shell.describeSelf({ title: '你好插件' })
    expect(await call('shell.plugins')).toEqual([{ title: '你好插件', entryId: 'home:hello', pkg: '@t/gwb-hello' }])
  })

  it('调用方卸载时它登记的窗格与名字自动注销', async () => {
    const { root } = await bootShell()
    const { shell, fiber } = await callerShell(root, hello)
    shell.registerPane({ id: 'main', title: '你好' })
    shell.describeSelf({ title: '你好插件' })
    await fiber.dispose()
    expect(shell.panes()).toEqual([])
    expect(shell.plugins()).toEqual([])
  })

  it('返回的注销函数可以提前注销', async () => {
    const { root } = await bootShell()
    const { shell } = await callerShell(root, hello)
    const unregister = shell.registerPane({ id: 'main', title: '你好' })
    unregister()
    expect(shell.panes()).toEqual([])
  })

  it('调用方的 fiber 上没有 entry 就抛错', async () => {
    const { root } = await bootShell()
    const { shell } = await callerShell(root, null)
    expect(() => shell.registerPane({ id: 'main', title: '你好' })).toThrow('取不到调用方的身份')
    expect(() => shell.describeSelf({ title: '你好' })).toThrow('取不到调用方的身份')
  })
})

describe('布局文件两条命令', () => {
  it('shell.layout.get 回 gwbData 里的 layout 文档，没存过回 undefined', async () => {
    expect(await (await bootShell()).call('shell.layout.get')).toBeUndefined()
    const doc = layoutDoc([{ id: 'd1', name: '桌面 1' }])
    expect(await (await bootShell({ layout: doc })).call('shell.layout.get')).toEqual(doc)
  })

  it('shell.layout.save 形状对就整份写入，形状不对回错、不写', async () => {
    const { call, data } = await bootShell()
    const doc = layoutDoc([{ id: 'd1', name: '桌面 1' }])
    expect(await call('shell.layout.save', doc)).toBeUndefined()
    expect(data.docs.get('layout')).toEqual(doc)
    expect(await call('shell.layout.save', { v: 1 })).toEqual({ ok: false, error: '布局档形状不对，不落盘' })
    expect(data.docs.get('layout')).toEqual(doc)
  })
})

describe('shell.env', () => {
  it('回 home、三张样式表、版本；没有 theme.startupCss 就没有 startupCss', async () => {
    const env = (await (await bootShell()).call('shell.env')) as Record<string, unknown>
    expect(env['home']).toBe('D:/fake-home')
    expect(env['styles']).toHaveLength(3)
    expect((env['styles'] as string[])[0]).toMatch(/^file:\/\/\/.*\/fake\/gwb-shell\/dist\/theme\.css$/)
    expect((env['styles'] as string[])[1]).toMatch(/\/dockview\.css$/)
    expect((env['styles'] as string[])[2]).toMatch(/\/style\.css$/)
    expect(env['versions']).toMatchObject({ kernel: '9.9.9' })
    expect(env).not.toHaveProperty('startupCss')
  })

  it('theme.startupCss 回非空字符串时带上 startupCss', async () => {
    const { bus, call } = await bootShell()
    bus.register({ name: 'theme.startupCss', plugin: '@t/theme' }, () => 'body{}')
    expect(await call('shell.env')).toMatchObject({ startupCss: 'body{}' })
  })
})

describe('shell.reload', () => {
  it('不在 Electron 主进程里回 ok:false', async () => {
    const reply = (await (await bootShell()).call('shell.reload')) as { ok: boolean; error: string }
    expect(reply.ok).toBe(false)
    expect(reply.error).toContain('拿不到 electron 的窗口列表')
  })
})

describe('桌面命令', () => {
  it('shell.desktop.list 读布局文件；没有文件回一张缺省桌面', async () => {
    expect(await (await bootShell()).call('shell.desktop.list')).toEqual({ desktops: [{ id: 'd1', name: '桌面 1' }], active: 'd1' })
    const doc = layoutDoc([{ id: 'd1', name: '甲' }, { id: 'd2', name: '乙' }], 'd2')
    expect(await (await bootShell({ layout: doc })).call('shell.desktop.list')).toEqual({
      desktops: [{ id: 'd1', name: '甲' }, { id: 'd2', name: '乙' }],
      active: 'd2',
    })
  })

  it('shell.desktop.switch：id 与 name 都没给回错；给了就转发', async () => {
    const { call, emitted } = await bootShell()
    expect(await call('shell.desktop.switch', {})).toEqual({ ok: false, error: 'id 与 name 至少给一个' })
    expect(await call('shell.desktop.switch', { id: 'd2', name: '' })).toEqual({ ok: true, relayed: true })
    expect(emitted).toEqual([{ t: 'gwb-shell-desktop', action: 'switch', id: 'd2' }])
  })

  it('shell.desktop.new：名字去两头空白，空名不带', async () => {
    const { call, emitted } = await bootShell()
    await call('shell.desktop.new', { name: '  工作  ' })
    await call('shell.desktop.new', { name: '   ' })
    await call('shell.desktop.new')
    expect(emitted).toEqual([
      { t: 'gwb-shell-desktop', action: 'new', name: '工作' },
      { t: 'gwb-shell-desktop', action: 'new' },
      { t: 'gwb-shell-desktop', action: 'new' },
    ])
  })

  it('shell.desktop.rename：参数不对、id 不在布局文件里都回错；对了就转发', async () => {
    const { call, emitted } = await bootShell({ layout: layoutDoc([{ id: 'd1', name: '甲' }]) })
    expect(((await call('shell.desktop.rename', { id: 'd1' })) as { ok: boolean }).ok).toBe(false)
    expect(((await call('shell.desktop.rename', { id: 'd9', name: '乙' })) as { error: string }).error).toContain('没有桌面 d9')
    expect(await call('shell.desktop.rename', { id: 'd1', name: ' 乙 ' })).toEqual({ ok: true, relayed: true })
    expect(emitted).toEqual([{ t: 'gwb-shell-desktop', action: 'rename', id: 'd1', name: '乙' }])
  })

  it('shell.desktop.delete：只剩一张回错；closed 是页面推来的清单里那张桌面上的窗格数', async () => {
    const single = await bootShell({ layout: layoutDoc([{ id: 'd1', name: '甲' }]) })
    expect(await single.call('shell.desktop.delete', { id: 'd1' })).toEqual({ ok: false, error: '只剩这一张桌面，删不了' })
    expect(((await single.call('shell.desktop.delete', { id: 'd7' })) as { error: string }).error).toContain('没有桌面 d7')

    const { call, emitted } = await bootShell({ layout: layoutDoc([{ id: 'd1', name: '甲' }, { id: 'd2', name: '乙' }]) })
    expect(await call('shell.desktop.delete', { id: 'd2' })).toEqual({ ok: true, relayed: true, closed: 0 })
    await call('shell.pane.sync', paneSync())
    expect(await call('shell.desktop.delete', { id: 'd2' })).toEqual({ ok: true, relayed: true, closed: 1 })
    expect(emitted).toEqual([
      { t: 'gwb-shell-desktop', action: 'delete', id: 'd2' },
      { t: 'gwb-shell-desktop', action: 'delete', id: 'd2' },
    ])
  })
})

function paneEntry(instance: string, desktop: string, paneId = 'main') {
  return { instance, desktop, group: 'g1', pkg: '@t/gwb-hello', entryId: 'home:hello', paneId, key: '', title: instance, preview: false, active: true }
}

function paneSync() {
  return {
    entries: [paneEntry('plugin:home:hello:main', 'd1'), paneEntry('plugin:home:hello:doc', 'd2', 'doc')],
    desktops: [{ id: 'd1', name: '甲' }, { id: 'd2', name: '乙' }],
    active: 'd1',
  }
}

describe('窗格命令', () => {
  it('shell.pane.list：页面没推过回空表；推过之后按注册表补 kind，插件没注册的算 tool', async () => {
    const { root, call } = await bootShell()
    expect(await call('shell.pane.list')).toEqual([])
    const { shell } = await callerShell(root, hello)
    shell.registerPane({ id: 'doc', title: '正文', kind: 'document' })
    expect(await call('shell.pane.sync', paneSync())).toEqual({ ok: true })
    const rows = (await call('shell.pane.list')) as { instance: string; kind: string }[]
    expect(rows.map((row) => [row.instance, row.kind])).toEqual([
      ['plugin:home:hello:main', 'tool'],
      ['plugin:home:hello:doc', 'document'],
    ])
  })

  it('shell.pane.sync 形状不对回错，缓存不变', async () => {
    const { call } = await bootShell()
    await call('shell.pane.sync', paneSync())
    expect(await call('shell.pane.sync', { entries: 'x' })).toEqual({ ok: false, error: '清单形状不对，没收' })
    expect(await call('shell.pane.list')).toHaveLength(2)
  })

  it('focus / close / send：参数不对回错；缓存里没有这个实例回错；没推过缓存就照样转发', async () => {
    const { call, emitted } = await bootShell()
    expect(((await call('shell.pane.focus', {})) as { ok: boolean }).ok).toBe(false)
    expect(await call('shell.pane.close', { instance: 'x' })).toEqual({ ok: true, relayed: true })
    await call('shell.pane.sync', paneSync())
    expect(((await call('shell.pane.focus', { instance: 'x' })) as { error: string }).error).toContain('窗格 x 不在清单里')
    expect(await call('shell.pane.focus', { instance: 'plugin:home:hello:main' })).toEqual({ ok: true, relayed: true })
    expect(emitted).toEqual([
      { t: 'gwb-shell-pane', action: 'close', instance: 'x' },
      { t: 'gwb-shell-pane', action: 'focus', instance: 'plugin:home:hello:main' },
    ])
  })

  it('send 到缓存里没有的桌面回错；newDesktop 不查桌面', async () => {
    const { call, emitted } = await bootShell()
    await call('shell.pane.sync', paneSync())
    const instance = 'plugin:home:hello:main'
    expect(((await call('shell.pane.send', { instance, desktop: 'd9' })) as { error: string }).error).toContain('没有桌面 d9')
    expect(await call('shell.pane.send', { instance, desktop: 'd2', follow: true })).toEqual({ ok: true, relayed: true })
    expect(await call('shell.pane.send', { instance, newDesktop: '新' })).toEqual({ ok: true, relayed: true })
    expect(emitted).toEqual([
      { t: 'gwb-shell-pane', action: 'send', instance, desktop: 'd2', follow: true },
      { t: 'gwb-shell-pane', action: 'send', instance, newDesktop: '新' },
    ])
  })
})

describe('shell.openPane', () => {
  it('参数不对、窗格不在注册表里回错；在就转发', async () => {
    const { root, call, emitted } = await bootShell()
    expect(((await call('shell.openPane', { entryId: 'home:hello' })) as { ok: boolean }).ok).toBe(false)
    expect(((await call('shell.openPane', { entryId: 'home:hello', paneId: 'main' })) as { error: string }).error).toContain(
      '不在注册表里',
    )
    const { shell } = await callerShell(root, hello)
    shell.registerPane({ id: 'main', title: '你好' })
    expect(await call('shell.openPane', { entryId: 'home:hello', paneId: 'main', key: 'k', preview: true })).toEqual({
      ok: true,
      relayed: true,
    })
    expect(emitted).toEqual([{ t: 'gwb-shell-open-pane', entryId: 'home:hello', paneId: 'main', key: 'k', preview: true }])
  })
})
