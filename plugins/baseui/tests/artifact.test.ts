import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物测试，只查本插件独有的：node 侧按值 import 的包名、浏览器侧源文件没混进 dist、radix / cva 与卸载入口
 * 打包进了 client.js。类名前缀、`var()` fallback、颜色只用令牌、浏览器侧只许 importmap 里的名字
 * 由 devkit 的样式检查与发版前检查负责，这里不另查。
 *
 * node 侧不许有按值 import 的包名还有一层意思：logger 与 plugin-manager 在这里是**可选**的
 * （局部注入，源码里只有 `import type {}`）。哪天有人把它写成运行时 import，这条
 * 会当场失败——否则现象是「home 里没装那两个基础插件时少注册一个窗格」之外
 * 还多一句 ERR_MODULE_NOT_FOUND，看不出是依赖写错了地方。
 *
 * 没有产物时整组跳过——门禁不依赖 build。
 */

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const built = fs.existsSync(distDir)

if (!built) console.warn('[gwb-baseui] dist/ 还没有生成，产物测试跳过（pnpm build 之后再跑）')

const CLIENT = 'client.js'

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

/** 顶层包名 import。只匹配行首：产物里顶层 import 都顶格写，字符串字面量里的总带着缩进 */
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

describe.skipIf(!built)('产物', () => {
  it('node 侧：没有按值 import 的包名——logger / plugin-manager 是局部注入的可选依赖，写成运行时 import 这里当场失败', () => {
    const bare = [...read('index.js').matchAll(BARE)].map((m) => m[1]!).filter((spec) => !spec.startsWith('node:'))
    expect(bare).toEqual([])
  })

  it('dist 下没有 client/ 目录——浏览器侧的源文件是 esbuild 的输入，不是产物', () => {
    expect(fs.existsSync(path.join(distDir, 'client'))).toBe(false)
  })

  it('radix / cva 打包进了 client.js——外置成包名就是运行时一句 Failed to resolve', () => {
    // 认编译后的产物，别写 JSX 里那种原样字面量：esbuild 会把属性编成对象的键
    expect(read(CLIENT)).toContain('data-slot')
  })

  it('卸载在界面上有入口：plugin-manager.uninstall 得打包进 client.js', () => {
    const client = read(CLIENT)
    // 只认 ASCII 标记：esbuild 默认把非 ASCII 转义成 \\uXXXX，中文在产物里搜不到
    expect(client).toContain('plugin-manager.uninstall')
    expect(client).toContain('pnpm remove')
  })
})
