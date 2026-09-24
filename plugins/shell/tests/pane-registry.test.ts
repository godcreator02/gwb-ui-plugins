import { describe, expect, it, vi } from 'vitest'
import { iconProblem } from '../src/pane-icon.js'
import { createPaneRegistry, type PaneOwner } from '../src/pane-registry.js'

/**
 * 窗格注册表。要钉住的是四样：身份由服务填而不是件自己报、注销只收自己那份、
 * 一条条目一个命名空间、图标名认不出当场出声。
 */

const echo: PaneOwner = { entryId: 'echo', pkg: '@godcreator/gwb-echo' }
/** 同一个包挂的第二条条目：两份独立配置的实例，各注册各的 */
const echo2: PaneOwner = { entryId: 'echo-2', pkg: '@godcreator/gwb-echo' }

/** 真跑时名单是 lucide 全集；这儿只放用得着的两枚 */
const catalog = { lucide: '1.0.0', keys: new Set(['Megaphone', 'LayoutGrid']) }

function fresh() {
  const warn = vi.fn<(message: string) => void>()
  return { warn, reg: createPaneRegistry(warn, (name) => iconProblem(name, catalog)) }
}

describe('register：件给三样，身份由服务填', () => {
  it('进表的那条带着 entryId 与 pkg', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'main', title: '回声', icon: 'megaphone' })
    expect(reg.list()).toEqual([
      { id: 'main', title: '回声', icon: 'megaphone', kind: 'tool', entryId: 'echo', pkg: '@godcreator/gwb-echo' },
    ])
  })

  it('icon 可以不给', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'main', title: '回声' })
    expect(reg.list()[0]).not.toHaveProperty('icon')
  })

  it('按注册先后排', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'b', title: 'B' })
    reg.register(echo, { id: 'a', title: 'A' })
    expect(reg.list().map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('件改不了已经进表的那条——存的是拷贝', () => {
    const { reg } = fresh()
    const spec = { id: 'main', title: '回声' }
    reg.register(echo, spec)
    spec.title = '被改了'
    expect(reg.list()[0]!.title).toBe('回声')
  })
})

describe('图标名：认不出照样进表，但登记那一刻说出来', () => {
  it('认得的正名不出声', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'view', title: '视图', icon: 'layout-grid' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('名单里没有的：进表、原样留着，warn 里带包名、窗格 id、那个名字与版本', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'view', title: '视图', icon: 'home' })
    expect(reg.list()[0]!.icon).toBe('home')
    expect(warn).toHaveBeenCalledOnce()
    const said = warn.mock.calls[0]![0]
    for (const part of ['gwb-echo', 'view', '"home"', '1.0.0']) expect(said).toContain(part)
  })

  it('不是 kebab-case 的也出声，话里说清要 kebab-case', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'view', title: '视图', icon: 'LayoutGrid' })
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]![0]).toContain('kebab-case')
  })
})

describe('一条条目一个命名空间', () => {
  it('同一个包的两条条目各注册一格同名的，两条都在', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'main', title: '一号' })
    reg.register(echo2, { id: 'main', title: '二号' })
    expect(reg.list().map((p) => [p.entryId, p.title])).toEqual([
      ['echo', '一号'],
      ['echo-2', '二号'],
    ])
    // 这不叫撞名：分得开的两格
    expect(warn).not.toHaveBeenCalled()
  })

  it('同一条条目注册两次同一个 id：后来者赢，但要说出来', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'main', title: '旧的' })
    reg.register(echo, { id: 'main', title: '新的' })
    expect(reg.list()).toHaveLength(1)
    expect(reg.list()[0]!.title).toBe('新的')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]![0]).toContain('main')
  })
})

describe('注销：只收自己那份', () => {
  it('摘掉一格，别的不动；摘两遍不炸', () => {
    const { reg } = fresh()
    const off = reg.register(echo, { id: 'a', title: 'A' })
    reg.register(echo, { id: 'b', title: 'B' })
    off()
    off()
    expect(reg.list().map((p) => p.id)).toEqual(['b'])
  })

  it('被后来者顶掉之后再摘，摘的不是新那条', () => {
    const { reg } = fresh()
    const off = reg.register(echo, { id: 'main', title: '旧的' })
    reg.register(echo, { id: 'main', title: '新的' })
    // 旧那格的 effect 这时才收尾（件重挂时正是这个顺序）
    off()
    expect(reg.list()[0]!.title).toBe('新的')
  })
})

describe('说不清自己是谁的一律抛——不静默进表', () => {
  it('空 id、空 title 都抛，话里带着包名', () => {
    const { reg } = fresh()
    expect(() => reg.register(echo, { id: '', title: '回声' })).toThrow(/gwb-echo/)
    expect(() => reg.register(echo, { id: 'main', title: '' })).toThrow(/main/)
    expect(reg.list()).toEqual([])
  })

  it('窗格 id 带冒号也抛——那是拼面板 id 的分隔符', () => {
    // entryId 自己就带冒号（实机 `home:hello`）。窗格 id 里再有一个的话,两组不同的
    // (条目, 窗格) 能拼出同一个面板 id,而开格那处的查重会把它当成「已经开着」、
    // 静默追个 `:2` 上去——人看到的是标题莫名多了个 (2),源头在别的件的注册参数里
    const { reg } = fresh()
    expect(() => reg.register(echo, { id: 'a:b', title: '回声' })).toThrow(/冒号/)
    expect(reg.list()).toEqual([])
  })
})

describe('client / style 给了就得是 file:// 地址、扩展名对得上，不对就抛', () => {
  const clientUrl = 'file:///D:/homes/demo/node_modules/@godcreator/gwb-echo/dist/client.js'
  const styleUrl = 'file:///D:/homes/demo/node_modules/@godcreator/gwb-echo/dist/style.css'

  it('从 import.meta.url 算出来的那种地址照常进表', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'main', title: '回声', client: clientUrl, style: styleUrl })
    expect(reg.list()[0]).toMatchObject({ client: clientUrl, style: styleUrl })
  })

  it('路径后面带查询串也算：看的是路径部分', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'main', title: '回声', client: `${clientUrl}?v=2`, style: `${styleUrl}?v=2` })
    expect(reg.list()).toHaveLength(1)
  })

  it('两个都不给仍然合法——打开后才显示没有入口', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'main', title: '回声' })
    expect(reg.list()[0]).not.toHaveProperty('client')
    expect(reg.list()[0]).not.toHaveProperty('style')
  })

  it('只给 client、不给 style 合法', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'main', title: '回声', client: clientUrl })
    expect(reg.list()).toHaveLength(1)
  })

  it('不是 file: 协议的抛：http 地址、Windows 盘符路径（会被解析成 d: 协议）', () => {
    const { reg } = fresh()
    expect(() => reg.register(echo, { id: 'main', title: '回声', client: 'https://example.com/client.js' })).toThrow(/file:\/\//)
    expect(() => reg.register(echo, { id: 'main', title: '回声', client: 'D:\\plugins\\echo\\dist\\client.js' })).toThrow(/file:\/\//)
    expect(() => reg.register(echo, { id: 'main', title: '回声', style: 'https://example.com/style.css' })).toThrow(/file:\/\//)
    expect(reg.list()).toEqual([])
  })

  it('扩展名不对的抛：client 要 .js、style 要 .css', () => {
    const { reg } = fresh()
    expect(() => reg.register(echo, { id: 'main', title: '回声', client: styleUrl })).toThrow(/\.js/)
    expect(() => reg.register(echo, { id: 'main', title: '回声', client: clientUrl.replace(/\.js$/, '.tsx') })).toThrow(/\.js/)
    expect(() => reg.register(echo, { id: 'main', title: '回声', style: clientUrl })).toThrow(/\.css/)
    expect(reg.list()).toEqual([])
  })

  it('解析不了的抛：相对路径、空串', () => {
    const { reg } = fresh()
    expect(() => reg.register(echo, { id: 'main', title: '回声', client: './client.js' })).toThrow(/file:\/\//)
    expect(() => reg.register(echo, { id: 'main', title: '回声', style: '' })).toThrow(/file:\/\//)
    expect(reg.list()).toEqual([])
  })

  it('报错里写明包、窗格、字段、收到的值和该给什么', () => {
    const { reg } = fresh()
    const registerWithRelativeClient = () => reg.register(echo, { id: 'view', title: '视图', client: 'dist/client.js' })
    for (const part of ['@godcreator/gwb-echo', '窗格 view', 'client', '"dist/client.js"', '.js', 'file://', 'import.meta.url']) {
      expect(registerWithRelativeClient).toThrow(part)
    }
  })
})

describe('注册要说清是工具窗格还是文档窗格（kind），说不出就是工具窗格', () => {
  it('不给 kind 进表就是 tool——老插件一个字不改都是工具窗格', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'main', title: '回声' })
    expect(reg.list()[0]!.kind).toBe('tool')
    expect(warn).not.toHaveBeenCalled()
  })

  it('给了 document / tool 原样进表', () => {
    const { reg } = fresh()
    reg.register(echo, { id: 'doc', title: '正文', kind: 'document' })
    reg.register(echo, { id: 'log', title: '日志', kind: 'tool' })
    expect(reg.list().map((p) => p.kind)).toEqual(['document', 'tool'])
  })

  it('kind 写错：照 tool 进表，登记那一刻 warn 一句，点名包与窗格', () => {
    const { reg, warn } = fresh()
    reg.register(echo, { id: 'doc', title: '正文', kind: 'documnet' as never })
    expect(reg.list()[0]!.kind).toBe('tool')
    expect(warn).toHaveBeenCalledOnce()
    const said = warn.mock.calls[0]![0]
    for (const part of ['gwb-echo', 'doc', '"documnet"']) expect(said).toContain(part)
  })

  it('说的是「打开对它是什么意思」，不是「能开几份」——那张老的 duplicable 开关没有回来', () => {
    // 一个窗格开几份仍取决于它装着几份不同的内容（`key`）；kind 只定查重范围与启动器的行为
    const { reg } = fresh()
    reg.register(echo, { id: 'main', title: '回声' })
    expect(Object.keys(reg.list()[0]!).sort()).toEqual(['entryId', 'id', 'kind', 'pkg', 'title'])
  })
})
