/**
 * 窗格图标名怎么认。**两半同吃这一份判法**：node 半登记时拿它对名单、认不出当场出声；
 * 浏览器半画标签时拿它从 lucide 全集里取那一枚。纯模块、零依赖。
 *
 * 认的是 **lucide 的正名，kebab-case**——lucide.dev 上图标页顶上写的那个名字（`layout-grid`、
 * `file-text`）。改过名的旧名（`home` 之于 `house`）不认；PascalCase（`LayoutGrid`）不认。
 */

/** 小写字母与数字，段间恰好一个连字符 */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 图标名 → lucide 全集里的导出名（`layout-grid` → `LayoutGrid`、`arrow-down-0-1` → `ArrowDown01`）。
 * 拼法跟 lucide 自己由正名拼导出名的一致：按连字符分段、段首大写、其余原样。
 * 不是 kebab-case 回 `undefined`。
 */
export function iconKey(name: string): string | undefined {
  if (!KEBAB.test(name)) return undefined
  return name
    .split('-')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('')
}

/** 构建时从打进浏览器束的那份 lucide-react 抄出来的名单，随 `dist/pane-icons.json` 发 */
export interface IconCatalog {
  /** 打进束的 lucide-react 版本——名单认不认一个名字，以这一版为准 */
  lucide: string
  /** 全集的导出名（PascalCase），跟浏览器半 `icons` 的键一一对应 */
  keys: ReadonlySet<string>
}

/** 名单文件的形状不对回 `undefined` */
export function parseIconCatalog(raw: unknown): IconCatalog | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const { lucide, keys } = raw as { lucide?: unknown; keys?: unknown }
  if (typeof lucide !== 'string' || !Array.isArray(keys) || keys.length === 0) return undefined
  if (!keys.every((k): k is string => typeof k === 'string')) return undefined
  return { lucide, keys: new Set(keys) }
}

/** 认得回 `undefined`，认不出回一句说清怎么改的话（不带是谁登记的——那半由调用方拼） */
export function iconProblem(name: string, catalog: IconCatalog): string | undefined {
  const key = iconKey(name)
  if (key === undefined) {
    return `图标名 ${JSON.stringify(name)} 不是 kebab-case——照 lucide.dev 上的正名写，如 layout-grid`
  }
  if (!catalog.keys.has(key)) {
    return `图标名 ${JSON.stringify(name)} 不在 lucide-react ${catalog.lucide} 的正名里——照 lucide.dev 上的正名写，改过名的旧名不认`
  }
  return undefined
}
