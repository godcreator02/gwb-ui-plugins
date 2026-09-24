import type { Versions } from './protocol.js'

/** 主进程 `process.versions` 里用到的三项 */
export interface RuntimeVersions {
  electron: string
  node: string
  chrome: string
}

/** `gwbKernel` 上报版本的两项 */
export interface KernelVersions {
  version: string
  launcherVersion?: string
}

/** node 侧：内核报的版本、本包清单原文、运行时版本 → `Versions` */
export function versionsOf(kernel: KernelVersions, manifest: string, runtime: RuntimeVersions): Versions {
  const shell = (JSON.parse(manifest) as { version: string }).version
  return {
    kernel: kernel.version,
    ...(kernel.launcherVersion === undefined ? {} : { launcher: kernel.launcherVersion }),
    shell,
    electron: runtime.electron,
    node: runtime.node,
    chrome: runtime.chrome,
  }
}

/** 浏览器侧：状态栏上写安装包（gwb-electron）与内核（gwb-kernel）两个版本，悬停时一行一项列全 */
export function versionCell(versions: Versions): { label: string; title: string } {
  const launcherLine =
    versions.launcher === undefined ? 'gwb-electron 未知：内核是从源码启动的，或安装包早于 0.3.1' : `gwb-electron ${versions.launcher}（安装包）`
  return {
    label: `gwb-electron ${versions.launcher ?? '未知'} · gwb-kernel ${versions.kernel}`,
    title: [
      launcherLine,
      `gwb-kernel ${versions.kernel}（内核）`,
      `外壳 ${versions.shell}`,
      `Electron ${versions.electron} · Node ${versions.node}`,
      `Chromium ${versions.chrome}`,
    ].join('\n'),
  }
}
