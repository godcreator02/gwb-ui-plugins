import type { DockviewTheme } from 'dockview-react'
import type { HostBridge } from './types.js'

/**
 * 开机的外观装配：跟 theme 件的那条软契约、我们自己的 dockview 主题。boot 挂表用
 * `applyThemeStyle`，画井用 `GWB_THEME`，收尾摘类用 `THEME_CLASSES`。
 */

/**
 * 主题件的启动样式命令。**软契约**：命令名两边各存一份字符串，外壳不 import 主题件的
 * 任何东西（那是 node 半的包，跟 hello 客户端不 import `shell.panes` 常量同一个道理）。
 * theme 件没装时总线自己回「没有这条命令」，这儿静默跳过——外壳不因此少一根毫毛。
 */
const THEME_COMMAND = 'theme.startupCss'
/** 页面上那张启动样式表的 id。主题件的编辑格预览时改的就是它 */
const THEME_STYLE_ID = 'gwb-theme-style'

/**
 * 开机把用户的外观样式（字体覆盖 + 自定义 CSS）放进页面。
 *
 * **必须在三张表之后、首帧之前**：这张表要压过令牌的默认值，同特异性下靠文档序取胜，
 * 所以它得是 head 里靠后的那张；而「重启后开机即生效」要求它赶在 createRoot 前落位。
 * 表幂等（按 id 取，已存在就改内容）——热换外壳时新壳重注同一张，不重不漏。
 */
export async function applyThemeStyle(host: HostBridge): Promise<void> {
  try {
    const reply = (await host.call(THEME_COMMAND)) as { ok?: boolean; data?: unknown; error?: string }
    if (reply.ok !== true || typeof reply.data !== 'string' || reply.data.trim() === '') return
    let el = document.getElementById(THEME_STYLE_ID)
    if (el === null) {
      el = document.createElement('style')
      el.id = THEME_STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = reply.data
  } catch (err) {
    console.warn(`[shell] 启动样式没取到（theme 件没装？）：${String(err)}`)
  }
}

/**
 * 主题类，**就我们自己这一个**。dockview 自带的 18 套一个不挂——`build.ts` 把那些块
 * 整类裁掉了，产物里只剩它无条件生效的基础规则加我们那张 theme。
 *
 * 曾经挂过它的 `dockview-theme-light` 当基底、我们只覆盖配色。那样形状（35px 标签条、
 * 全直角、零间距）永远是它的，改起来是在别人的主张上打补丁。现在整套归我们。
 *
 * **亮暗不靠换这个类**——配色全是 `var(--…)`，令牌跟着 `html.dark` 变。
 */
export const THEME_CLASSES = ['dockview-theme-gwb']

/**
 * **必须经 `theme` 选项交给 dockview**，光挂在 `<html>` 上没用：dockview 自己会把
 * 主题类名写到它内部的 `.dv-shell` 上（不给就是默认的 `dockview-theme-abyss`），
 * 那一层比 `<html>` 近，把我们的值整个压掉——症状是井底一片深蓝黑，而 `<html>` 上读
 * `--dv-group-view-background-color` 明明是对的。这是实机撞出来的。
 *
 * `className` 那边是 `split(' ')` 收的，所以一个字段塞得下两个类。
 */
export const GWB_THEME: DockviewTheme = {
  name: 'gwb',
  className: THEME_CLASSES.join(' '),
  // 跟默认深色对齐：boot 时给 <html> 挂 dark，令牌整套走暗的那半
  colorScheme: 'dark',
  // **沟 = gap: 8**。margin 算术是精确的（每个可见格让出 margin×(n-1)/n，最后一格
  // 右边正好贴容器边，实测零溢出）。外圈环走 .dv-shell 自身的 padding（见
  // dockview-theme.css 的 .dockview-theme-gwb.dv-shell）——它挂在被 ResizeObserver
  // 量 contentRect 的元素上，padding 天然不算进可用尺寸（dockview 官方
  // .dockview-spaced 同一机制）。内衬绝不能打在 .dv-shell 与 .dv-grid-view 之间：
  // BaseGrid.layout 会把网格根硬写成壳的 contentRect 尺寸，中间任何 padding 都会
  // 溢出裁边 + 触发 .dv-view 的滚动条。
  gap: 8,
  // 拖拽落点用整块高亮，不用细线——卡是填色的，fill 才看得清
  dndTabIndicator: 'fill',
}
