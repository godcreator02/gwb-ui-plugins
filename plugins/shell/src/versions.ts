import type { Versions } from './protocol.js'

/**
 * 状态栏版本那一格的两段纯逻辑：node 半拼 `Versions`，浏览器半把它排成格子上的字与悬停的字。
 * 零依赖（不带 cordis、不带 DOM），两半各打进各的束。
 */

/** 主进程 `process.versions` 里本件用得着的三格。Electron 主进程里三格都在 */
export interface RuntimeVersions {
  electron: string
  node: string
  chrome: string
}

/** node 半：内核报的版本、本包清单原文、运行时三格 → `Versions` */
export function versionsOf(kernel: string, manifest: string, runtime: RuntimeVersions): Versions {
  const shell = (JSON.parse(manifest) as { version: string }).version
  return { kernel, shell, electron: runtime.electron, node: runtime.node, chrome: runtime.chrome }
}

/** 浏览器半：格子上写产品版本（发行包就叫 gwb v<内核版>），悬停一行一样列全 */
export function versionCell(v: Versions): { label: string; title: string } {
  return {
    label: `gwb ${v.kernel}`,
    title: [`内核 ${v.kernel}`, `外壳 ${v.shell}`, `Electron ${v.electron} · Node ${v.node}`, `Chromium ${v.chrome}`].join('\n'),
  }
}
