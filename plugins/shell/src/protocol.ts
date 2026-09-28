/** 纯模块、零依赖：node 侧与浏览器侧各自打包进自己的产物，共用这些命令名，不各抄一份字符串 */

/** 浏览器侧取两张表的命令 */
export const PANES_COMMAND = 'shell.panes'
export const PLUGINS_COMMAND = 'shell.plugins'

/** 浏览器侧每次启动时取一次的环境 */
export const ENV_COMMAND = 'shell.env'

/** 页面专用：页面把所有桌面上开着的窗格推给 node 侧缓存，`shell.pane.list` 读这份缓存；别的调用方推进来就改写了 list 的回执 */
export const PANE_SYNC_COMMAND = 'shell.pane.sync'

/** 状态栏环境项显示的版本 */
export interface Versions {
  /** `gwbKernel.version`，内核读自己的包清单报的 */
  kernel: string
  /** 外壳包清单里的版本 */
  shell: string
  /** 主进程 `process.versions` 里的三项 */
  electron: string
  node: string
  chrome: string
}

export interface ShellEnv {
  home: string
  /** 按序加载：令牌表、dockview 表、外壳自己的表 */
  styles: string[]
  /** 用户外观样式（主题插件的字体覆盖与自定义 CSS），注入在三张表之后；主题插件没装或没设置就没有 */
  startupCss?: string
  versions: Versions
}
