/**
 * 跨半的命令名与环境形状。**纯模块、零依赖**（不带 cordis、不带 DOM），node 半与
 * 浏览器半各打进各的束——`layout.ts` 走的同一条路。两半不 import 对方的理由是「别把
 * cordis 拖进浏览器束」，纯常量没有这个问题，所以跨半的命令名住这儿、各吃一份，
 * 不再两边抄字符串（抄了的那两处迟早漂，而漂了没有任何报错）。
 *
 * `theme.startupCss` 那类**跨件**软契约不归这儿——那是两个件各存一份字符串的约定，外壳这边
 * 只有 node 半用它（`startup-style.ts`），没有第二份。
 */

/** 浏览器半取表的两条命令。注册与调用两处同吃这两个常量 */
export const PANES_COMMAND = 'shell.panes'
export const PLUGINS_COMMAND = 'shell.plugins'

/** 浏览器半开机问一次的环境命令 */
export const ENV_COMMAND = 'shell.env'

/**
 * 页面把「所有桌面上开着的窗格」推给 node 半缓存的那条（`shell.pane.list` 读这份缓存）。
 * **页面专用**：命令总线上谁都调得到它，别的调用方推一份进来就是改了 list 的回执
 */
export const PANE_SYNC_COMMAND = 'shell.pane.sync'

/** 状态栏那一格报的版本：内核自己报的、本件自己的、运行时的三样 */
export interface Versions {
  /** `gwbKernel.version`——内核读自己包清单报的 */
  kernel: string
  /** 本件（外壳）自己包清单里的版本 */
  shell: string
  /** 主进程 `process.versions` 里的三格 */
  electron: string
  node: string
  chrome: string
}

export interface ShellEnv {
  home: string
  /** 按序加载：令牌表、dockview 表、本件自己的表 */
  styles: string[]
  /** 用户外观样式（gwb-theme 的字体覆盖 + 自定义 CSS），注在三张表之后。theme 没装或没设就没有这一项 */
  startupCss?: string
  versions: Versions
}
