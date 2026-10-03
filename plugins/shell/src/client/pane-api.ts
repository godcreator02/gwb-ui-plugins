/**
 * 子路径 `@godcreator/gwb-shell/pane` 的入口：窗格插件浏览器侧 `mountPane` 用到的类型，只有类型。
 * 它引用到的文件里不许有包名 import——调用方的浏览器侧 tsconfig 只有 DOM 类型，引进来的每个包都得由调用方列进 dev。
 */

export type { HostBridge, PaneArgs, PaneHandle, ShellBridge, StatusItemArgs, StatusItemHandle } from './types.js'
export type { OpenPaneOptions, PaneKind, Placement } from '../openable.js'
export type { PaneContent } from '../panels.js'
