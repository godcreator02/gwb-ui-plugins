import { describe, expect, it, vi } from 'vitest'
import { iconProblem } from '../src/pane-icon.js'
import { createStatusItemRegistry } from '../src/status-item-registry.js'

/**
 * 状态栏按钮表。判据跟窗格表同源（身份由服务填、撞名后来者赢、注销只收自己那份、图标名认不出出声），
 * 多一条：表每变一次都要通知页面重新取，插件比页面晚加载时按钮才出现得了。
 */

const echo = { entryId: 'echo', pkg: '@godcreator/gwb-echo' }
const echo2 = { entryId: 'echo-2', pkg: '@godcreator/gwb-echo' }

const catalog = { lucide: '1.0.0', keys: new Set(['PenLine']) }
const CLIENT = 'file:///D:/plugins/echo/dist/client.js'
const STYLE = 'file:///D:/plugins/echo/dist/style.css'

function fresh() {
  const warn = vi.fn<(message: string) => void>()
  const onChange = vi.fn<() => void>()
  return { warn, onChange, reg: createStatusItemRegistry(warn, (name) => iconProblem(name, catalog), onChange) }
}

describe('register：登记一个状态栏按钮', () => {
  it('进表的那条带着 entryId 与 pkg，并通知一次', () => {
    const { reg, onChange } = fresh()
    reg.register(echo, { id: 'quick', title: '快速记录', icon: 'pen-line', client: CLIENT, style: STYLE })
    expect(reg.list()).toEqual([
      { id: 'quick', title: '快速记录', icon: 'pen-line', client: CLIENT, style: STYLE, entryId: 'echo', pkg: '@godcreator/gwb-echo' },
    ])
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('按登记先后排', () => {
    const { reg } = fresh()
    reg.register(echo2, { id: 'b', title: '二号', client: CLIENT })
    reg.register(echo, { id: 'a', title: '一号', client: CLIENT })
    expect(reg.list().map((item) => item.title)).toEqual(['二号', '一号'])
  })

  it('图标名认不出：照样进表，warn 里带包名与那个名字', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'quick', title: '快速记录', icon: 'pen-lin', client: CLIENT })
    expect(reg.list()).toHaveLength(1)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]![0]).toContain('gwb-echo')
    expect(warn.mock.calls[0]![0]).toContain('"pen-lin"')
  })

  it('同一条条目的同一个 id 登记两次：后来者赢，但要说出来', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'quick', title: '旧的', client: CLIENT })
    reg.register(echo, { id: 'quick', title: '新的', client: CLIENT })
    expect(reg.list().map((item) => item.title)).toEqual(['新的'])
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('形状不对就抛，不进表也不通知', () => {
  const cases: [string, Parameters<ReturnType<typeof createStatusItemRegistry>['register']>[1], RegExp][] = [
    ['空 id', { id: '', title: '快速记录', client: CLIENT }, /没有 id/],
    ['id 带冒号', { id: 'a:b', title: '快速记录', client: CLIENT }, /带冒号/],
    ['空标题', { id: 'quick', title: '', client: CLIENT }, /没有标题/],
    ['client 不是 file://', { id: 'quick', title: '快速记录', client: 'https://x/client.js' }, /client 收到/],
    ['client 不是 .js', { id: 'quick', title: '快速记录', client: 'file:///D:/x/client.css' }, /client 收到/],
    ['style 不是 .css', { id: 'quick', title: '快速记录', client: CLIENT, style: 'file:///D:/x/style.js' }, /style 收到/],
  ]
  for (const [name, spec, message] of cases) {
    it(name, () => {
      const { reg, onChange } = fresh()
      expect(() => reg.register(echo, spec)).toThrow(message)
      expect(reg.list()).toEqual([])
      expect(onChange).not.toHaveBeenCalled()
    })
  }
})

describe('注销：只收自己那份', () => {
  it('摘掉一条别的不动、通知一次；摘两遍不炸也不再通知', () => {
    const { reg, onChange } = fresh()
    const off = reg.register(echo, { id: 'quick', title: '一号', client: CLIENT })
    reg.register(echo2, { id: 'quick', title: '二号', client: CLIENT })
    onChange.mockClear()
    off()
    off()
    expect(reg.list().map((item) => item.entryId)).toEqual(['echo-2'])
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('被后来者顶掉之后再摘，摘的不是新那条', () => {
    const { reg } = fresh()
    const off = reg.register(echo, { id: 'quick', title: '旧的', client: CLIENT })
    reg.register(echo, { id: 'quick', title: '新的', client: CLIENT })
    off()
    expect(reg.list().map((item) => item.title)).toEqual(['新的'])
  })
})
