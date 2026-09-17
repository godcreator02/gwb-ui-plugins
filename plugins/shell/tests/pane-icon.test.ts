import { createRequire } from 'node:module'
import dynamicIconImports from 'lucide-react/dynamicIconImports.mjs'
import { describe, expect, it } from 'vitest'
import { iconKey, iconProblem, parseIconCatalog, type IconCatalog } from '../src/pane-icon.js'

/**
 * 图标名的认法。两半同吃 `iconKey`：node 半对名单、浏览器半从 lucide 全集取——所以要钉住的
 * 是「它跟 lucide 自己由正名拼导出名的规则对得上」，拿打进束的那份 lucide-react 当面对账。
 */

const require = createRequire(import.meta.url)
const lucide = require('lucide-react') as { icons: Record<string, unknown> }
const lucideVersion = (require('lucide-react/package.json') as { version: string }).version

/** 跟 build.ts 抄进 dist/pane-icons.json 的是同一份 */
const real: IconCatalog = { lucide: lucideVersion, keys: new Set(Object.keys(lucide.icons)) }

describe('iconKey：kebab 正名 → lucide 导出名', () => {
  it('按连字符分段、段首大写，数字段原样', () => {
    expect(iconKey('layout-grid')).toBe('LayoutGrid')
    expect(iconKey('arrow-down-0-1')).toBe('ArrowDown01')
    expect(iconKey('grid-2x2')).toBe('Grid2x2')
    expect(iconKey('x')).toBe('X')
  })

  it('不是 kebab-case 的一律不认', () => {
    for (const name of ['', 'LayoutGrid', 'layoutGrid', 'layout_grid', 'layout--grid', '-grid', 'grid-', 'layout grid', 'constructor-']) {
      expect(iconKey(name), name).toBeUndefined()
    }
  })

  it('lucide 全集每一枚都有一个 kebab 名拼得到它——正名规则跟 lucide 对得上', () => {
    const names = Object.keys(dynamicIconImports)
    // lucide 自己的名字表（正名加旧名）全是 kebab-case
    expect(names.filter((n) => iconKey(n) === undefined)).toEqual([])
    const reached = new Set(names.map((n) => iconKey(n)))
    expect([...real.keys].filter((k) => !reached.has(k))).toEqual([])
  })
})

describe('iconProblem：拿真名单认', () => {
  it('生态里登记过的图标名全认得（含反馈里画成 # 的那六个）', () => {
    const inUse = [
      'scroll-text', 'store', 'puzzle', 'flask-conical', 'panel-left', 'folder-open', 'file-text', 'folders',
      'receipt', 'eye', 'activity', 'palette', 'gauge', 'layout-grid',
    ]
    expect(inUse.filter((n) => iconProblem(n, real) !== undefined)).toEqual([])
  })

  it('旧名、拼错的认不出，话里带版本；PascalCase 认不出，话里说要 kebab-case', () => {
    expect(iconProblem('home', real)).toContain(lucideVersion)
    expect(iconProblem('layout-gird', real)).toContain('"layout-gird"')
    expect(iconProblem('LayoutGrid', real)).toContain('kebab-case')
  })
})

describe('parseIconCatalog：名单文件的形状', () => {
  it('认得的形状收成 Set', () => {
    const catalog = parseIconCatalog({ lucide: '1.44.0', keys: ['LayoutGrid', 'House'] })
    expect(catalog?.lucide).toBe('1.44.0')
    expect(catalog?.keys.has('House')).toBe(true)
  })

  it('形状不对回 undefined', () => {
    for (const raw of [null, 'x', {}, { lucide: '1', keys: [] }, { lucide: 1, keys: ['A'] }, { lucide: '1', keys: ['A', 2] }]) {
      expect(parseIconCatalog(raw), JSON.stringify(raw)).toBeUndefined()
    }
  })
})
