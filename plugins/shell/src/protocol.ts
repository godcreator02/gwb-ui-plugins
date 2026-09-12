/**
 * 跨半的命令名与环境形状。**纯模块、零依赖**（不带 cordis、不带 DOM），node 半与
 * 浏览器半各打进各的束——`layout.ts` 走的同一条路。两半不 import 对方的理由是「别把
 * cordis 拖进浏览器束」，纯常量没有这个问题，所以跨半的命令名住这儿、各吃一份，
 * 不再两边抄字符串（抄了的那两处迟早漂，而漂了没有任何报错）。
 *
 * `theme.startupCss` 那类**跨仓**软契约不归这儿——那是两个仓各存一份字符串的约定，
 * 本仓内没有第二份。
 */

/** 浏览器半取表的两条命令。注册与调用两处同吃这两个常量 */
export const PANES_COMMAND = 'shell.panes'
export const PLUGINS_COMMAND = 'shell.plugins'

/** 浏览器半开机问一次的环境命令 */
export const ENV_COMMAND = 'shell.env'

export interface ShellEnv {
  home: string
  /** 按序加载：令牌表、dockview 表、本件自己的表 */
  styles: string[]
}
