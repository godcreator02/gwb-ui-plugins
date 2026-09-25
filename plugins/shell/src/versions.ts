import type { Versions } from './protocol.js'

/** 主进程 `process.versions` 里用到的三项 */
export interface RuntimeVersions {
  electron: string
  node: string
  chrome: string
}

/** `gwbKernel` 上报版本的那一项 */
export interface KernelVersions {
  version: string
}

/** node 侧：内核报的版本、本包清单原文、运行时版本 → `Versions` */
export function versionsOf(kernel: KernelVersions, manifest: string, runtime: RuntimeVersions): Versions {
  const shell = (JSON.parse(manifest) as { version: string }).version
  return {
    kernel: kernel.version,
    shell,
    electron: runtime.electron,
    node: runtime.node,
    chrome: runtime.chrome,
  }
}

/** 浏览器侧：状态栏上只写内核（gwb-kernel）版本，其余版本在悬停提示里一行一项列全 */
export function versionCell(versions: Versions): { label: string; title: string } {
  return {
    label: `gwb-kernel ${versions.kernel}`,
    title: [
      `gwb-kernel ${versions.kernel}（内核）`,
      `外壳 ${versions.shell}`,
      `Electron ${versions.electron} · Node ${versions.node}`,
      `Chromium ${versions.chrome}`,
    ].join('\n'),
  }
}
