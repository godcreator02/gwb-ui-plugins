import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物与包清单测试，只查本插件独有的：两侧产物的文件名单、node 侧按值 import 的包名、注册窗格时报上的地址、
 * 外壳在 peer 里标可选。类名前缀、`var()` fallback、颜色只用令牌、浏览器侧只许 importmap 里的名字
 * 由 devkit 的样式检查与发版前检查负责，这里不另查。
 *
 * 没有产物时产物那组跳过——门禁不依赖 build。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '../dist')
const built = fs.existsSync(distDir)

if (!built) console.warn('[gwb-theme] dist/ 还没有生成，产物测试跳过（pnpm build 之后再跑）')

/** 顶层包名 import。只匹配行首：字符串字面量里的 import 总带着缩进，顶格的才是顶层 import */
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

describe.skipIf(!built)('产物', () => {
  it('两侧各一个 js——node 侧 index.js、浏览器侧 client.js，外加 style.css', () => {
    const files = fs.readdirSync(distDir).sort()
    expect(files).toEqual(['client.js', 'index.js', 'style.css'])
  })

  it('node 侧：没有按值 import 的包名——内核包的包根一加载就启动 Electron 应用，只能 import type', () => {
    const text = fs.readFileSync(path.join(distDir, 'index.js'), 'utf8')
    const bare = [...text.matchAll(BARE)].map((m) => m[1]!).filter((spec) => !spec.startsWith('node:'))
    expect(bare).toEqual([])
  })
})

describe('注册窗格时报上地址', () => {
  const source = fs.readFileSync(path.resolve(here, '../src/index.ts'), 'utf8')

  /**
   * 内核不读 exports 表：插件注册窗格时报上浏览器侧代码与样式表的 `file://` 地址，
   * 从自己的 `import.meta.url` 算。漏了这两个字段的症状是窗格打开后只显示一句错误，
   * 而那要打开那个窗格才看得见——所以在这里检查。
   */
  it('两个地址都从 import.meta.url 算', () => {
    expect(source).toContain("new URL('./client.js', import.meta.url).href")
    expect(source).toContain("new URL('./style.css', import.meta.url).href")
  })

  it('registerPane 把两个地址都报上去了', () => {
    expect(source).toContain('client: CLIENT_URL')
    expect(source).toContain('style: STYLE_URL')
  })
})

describe('包清单', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(here, '../package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
    devDependencies?: Record<string, string>
  }

  it('外壳写在 peer 里、标可选，不另写 dev——没装外壳时本插件照常加载，由 inject 里没有 gwbShell 保证', () => {
    expect(manifest.peerDependencies?.['@godcreator/gwb-shell']).toBeDefined()
    expect(manifest.peerDependenciesMeta?.['@godcreator/gwb-shell']?.optional).toBe(true)
    expect(manifest.devDependencies?.['@godcreator/gwb-shell']).toBeUndefined()
  })
})
