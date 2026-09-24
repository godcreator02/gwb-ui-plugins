import type { Versions } from './protocol.js'

/** 主进程 `process.versions` 里用到的三项 */
export interface RuntimeVersions {
  electron: string
  node: string
  chrome: string
}

/** node 侧：内核报的版本、本包清单原文、运行时版本 → `Versions` */
export function versionsOf(kernel: string, manifest: string, runtime: RuntimeVersions): Versions {
  const shell = (JSON.parse(manifest) as { version: string }).version
  return { kernel, shell, electron: runtime.electron, node: runtime.node, chrome: runtime.chrome }
}

/** 浏览器侧：状态栏上写 `gwb <内核版>`（发行包就叫这个名字），悬停时一行一样列全 */
export function versionCell(versions: Versions): { label: string; title: string } {
  return {
    label: `gwb ${versions.kernel}`,
    title: [`内核 ${versions.kernel}`, `外壳 ${versions.shell}`, `Electron ${versions.electron} · Node ${versions.node}`, `Chromium ${versions.chrome}`].join('\n'),
  }
}
