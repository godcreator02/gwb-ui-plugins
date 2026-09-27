import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * react 的四个包名打成浏览器能直接 import 的 ESM，放进 dist/react/；shell 经内核 registerImports 登记这四个文件。
 * 用 esbuild：rolldown 在 browser 平台对「CJS require 外置包」保留 require，产物进浏览器就报错；esbuild 会把它提升成 import
 */

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(packageDir, 'dist', 'react')

/** react-dom 两份把 react 外置：它们要和 react.js 用同一个实例，由页面 importmap 指到同一个文件 */
const BUNDLES = [
  { entry: 'src/react/react.ts', out: 'react.js', external: [] as string[] },
  { entry: 'src/react/react-jsx-runtime.ts', out: 'react-jsx-runtime.js', external: [] as string[] },
  { entry: 'src/react/react-dom.ts', out: 'react-dom.js', external: ['react'] },
  { entry: 'src/react/react-dom-client.ts', out: 'react-dom-client.js', external: ['react'] },
]

/**
 * react-dom 在工厂函数内部调 `require('react')`，esbuild 提不到顶层，产物里留一个 `__require` 探针，浏览器里一运行就报错。
 * 修补：文件头加一句 import，再把探针换成只认 react 的同步解析器。认的是 esbuild 生成代码的形状，认不出就让构建失败
 */
const REQUIRE_SHIM = /var __require = \/\* @__PURE__ \*\/ \(\(x\) => typeof require[\s\S]*?is not supported'\);\s*\n\}\);/

function patchRequireShim(file: string): void {
  const code = fs.readFileSync(file, 'utf8')
  if (!code.includes('__require')) return
  if (!REQUIRE_SHIM.test(code)) {
    throw new Error(`${path.basename(file)}：产物里有 __require，但认不出它的形状——esbuild 生成的代码变了，对一下 REQUIRE_SHIM`)
  }
  const patched = code.replace(
    REQUIRE_SHIM,
    'var __require = (id) => {\n' +
      // react-dom 要用 React 的内部成员，所以回 CJS 的 module.exports 原对象
      '  if (id === "react") return __gwb_react.default;\n' +
      '  throw new Error("gwb-shell：react 打包产物里出现了没想到的 require：" + id);\n' +
      '};',
  )
  fs.writeFileSync(file, `import * as __gwb_react from "react";\n${patched}`)
}

for (const bundle of BUNDLES) {
  await build({
    entryPoints: [bundle.entry],
    outfile: path.join(outDir, bundle.out),
    external: bundle.external,
    absWorkingDir: packageDir,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    bundle: true,
    minify: false,
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  })
  if (bundle.external.includes('react')) patchRequireShim(path.join(outDir, bundle.out))
}
