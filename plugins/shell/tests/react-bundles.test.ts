import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * scripts/build-react.ts 的产物。根目录 pnpm check 先构建内核包，这里读的是真实产物：
 * 浏览器里没有 require，产物里留一个没修补的 require 探针，要到页面上打开窗格才报错
 */

const reactDir = path.join(import.meta.dirname, '..', 'dist', 'react')
const BUNDLES = ['react.js', 'react-jsx-runtime.js', 'react-dom.js', 'react-dom-client.js']

function read(file: string): string {
  return fs.readFileSync(path.join(reactDir, file), 'utf8')
}

describe('react 的打包产物', () => {
  it('四个文件都在，里面没有 require 探针', () => {
    for (const file of BUNDLES) expect(read(file)).not.toContain('typeof require')
  })

  it('react-dom 两个文件外置 react，并在文件头 import 它给修补过的 __require 用', () => {
    for (const file of ['react-dom.js', 'react-dom-client.js']) {
      const code = read(file)
      expect(code.startsWith('import * as __gwb_react from "react";')).toBe(true)
      expect(code).toContain('if (id === "react") return __gwb_react.default;')
    }
  })

  it('react.js 带具名导出：少一个的话窗格加载时报 does not provide an export named', () => {
    const exported = /export\s*\{([^}]*)\}/.exec(read('react.js'))?.[1] ?? ''
    const names = exported.split(',').map((one) => one.trim().split(/\s+as\s+/).at(-1))
    for (const name of ['default', 'useState', 'useEffect', 'createElement', 'useEffectEvent']) expect(names).toContain(name)
  })
})
