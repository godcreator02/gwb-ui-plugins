import type { DockviewTheme } from 'dockview-react'

/**
 * 开机的外观装配：用户外观样式、我们自己的 dockview 主题。boot 注样式用 `applyStartupCss`，
 * 画井用 `GWB_THEME`，收尾摘类用 `THEME_CLASSES`。
 */

/** 页面上那张启动样式表的 id。主题件的编辑格预览时改的就是它 */
const THEME_STYLE_ID = 'gwb-theme-style'

/**
 * 开机把用户的外观样式（gwb-theme 的字体覆盖 + 自定义 CSS）放进页面。值是 `shell.env` 带来的
 * ——问不问主题件、主题件在不在，node 半已经判过了（`startup-style.ts`），这儿只管落位。
 *
 * **必须在三张表之后、首帧之前**：这张表要压过令牌的默认值，同特异性下靠文档序取胜，
 * 所以它得是 head 里靠后的那张；而「重启后开机即生效」要求它赶在 createRoot 前落位。
 * 表幂等（按 id 取，已存在就改内容；这一回没有就摘掉）——热换外壳时新壳照当下的值重注，
 * 不重不漏，theme 这期间被卸了也不留旧表。
 */
export function applyStartupCss(css: string | undefined): void {
  const existing = document.getElementById(THEME_STYLE_ID)
  if (css === undefined) {
    existing?.remove()
    return
  }
  const el = existing ?? document.head.appendChild(Object.assign(document.createElement('style'), { id: THEME_STYLE_ID }))
  el.textContent = css
}

/**
 * 主题类，**就我们自己这一个**。dockview 自带的 18 套一个不挂——`build.ts` 把那些块
 * 整类裁掉了，产物里只剩它无条件生效的基础规则加我们那张 theme。整套归我们：形状
 * 与配色不搭在别人的基底上打补丁（曾经挂过它的内置主题当基底，判据见文档站）。
 *
 * **亮暗不靠换这个类**——配色全是 `var(--…)`，令牌跟着 `html.dark` 变。
 */
export const THEME_CLASSES = ['dockview-theme-gwb']

/**
 * **必须经 `theme` 选项交给 dockview**，光挂在 `<html>` 上没用：dockview 把主题类名
 * 写在自己内部的 `.dv-shell` 上，那一层比 `<html>` 近（撞墙经过见文档站）。
 * `className` 是 `split(' ')` 收的，一个字段塞得下两个类。
 */
export const GWB_THEME: DockviewTheme = {
  name: 'gwb',
  className: THEME_CLASSES.join(' '),
  // 跟默认深色对齐：boot 时给 <html> 挂 dark，令牌整套走暗的那半
  colorScheme: 'dark',
  // **沟 = gap: 8**：外圈环走 .dv-shell 自身的 padding（ResizeObserver 量的是
  // contentRect，padding 不算进可用尺寸）。内衬绝不能打在 .dv-shell 与
  // .dv-grid-view 之间——网格根会被硬写成壳的 contentRect 尺寸，中间的 padding
  // 就是溢出裁边。算术与判据见文档站。
  gap: 8,
  // 拖拽落点用整块高亮，不用细线——卡是填色的，fill 才看得清
  dndTabIndicator: 'fill',
}
