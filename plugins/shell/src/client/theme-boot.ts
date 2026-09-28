import type { DockviewTheme } from 'dockview-react'

/** 主题插件的外观窗格预览时改的也是这张表 */
const THEME_STYLE_ID = 'gwb-theme-style'

/**
 * 必须在三张表之后、createRoot 之前注入：它要靠文档顺序压过令牌默认值，重启后又要第一帧就生效。
 * 按 id 幂等：已有就改内容，这次没有就移除，换外壳时不重复也不残留
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

/** 只有我们自己这一个；dockview 自带的 18 套在 build.ts 里整类裁掉了。亮暗不靠换类，靠令牌跟着 `html.dark` 变 */
export const THEME_CLASSES = ['dockview-theme-gwb']

/** 必须经 `theme` 选项交给 dockview：它把主题类写在自己的 `.dv-shell` 上，挂在 `<html>` 上会被覆盖 */
export const GWB_THEME: DockviewTheme = {
  name: 'gwb',
  className: THEME_CLASSES.join(' '),
  // 与启动时给 <html> 加的 dark 类一致
  colorScheme: 'dark',
  // 组间缝只用 gap；外圈留白走 .dv-shell 自身的 padding。别在 .dv-shell 与 .dv-grid-view 之间加内边距：
  // 网格根被写成 .dv-shell 的 contentRect 尺寸，多出的 padding 会溢出、边缘被裁掉
  gap: 8,
  // 拖放落点整块高亮：标签是填色的，细线看不清
  dndTabIndicator: 'fill',
}
