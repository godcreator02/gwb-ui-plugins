/** 小写字母与数字，段间恰好一个连字符 */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * lucide 正名 → lucide 全集里的导出名（`layout-grid` → `LayoutGrid`、`arrow-down-0-1` → `ArrowDown01`），
 * 拼法与 lucide 自己的一致；不是 kebab-case 回 `undefined`
 */
export function iconKey(name: string): string | undefined {
  if (!KEBAB_CASE.test(name)) return undefined
  return name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('')
}

/** 构建时从打包进浏览器侧的那份 lucide-react 生成的名单，随 `dist/pane-icons.json` 发布 */
export interface IconCatalog {
  /** 打包进去的 lucide-react 版本 */
  lucide: string
  /** 全集的导出名（PascalCase），与浏览器侧 `icons` 的键一一对应 */
  keys: ReadonlySet<string>
}

/** 名单文件的形状不对回 `undefined` */
export function parseIconCatalog(raw: unknown): IconCatalog | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const { lucide, keys } = raw as { lucide?: unknown; keys?: unknown }
  if (typeof lucide !== 'string' || !Array.isArray(keys) || keys.length === 0) return undefined
  if (!keys.every((key): key is string => typeof key === 'string')) return undefined
  return { lucide, keys: new Set(keys) }
}

/** 认得回 `undefined`，认不出回一句怎么改（不含登记方是谁，由调用方拼上） */
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
