import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import { mountPane as mountLoggerPane } from './panes/logger/index'
import { mountPane as mountPluginManagerPane } from './panes/plugin-manager/index'

/**
 * 浏览器侧入口：外壳打开窗格时 import 本文件（dist/client.js），调它导出的 `mountPane`。
 * 两个窗格共用这份 client.js 与 style.css，按 `pane.id` 分派；认不出的 id 在窗格里显示一句错误。
 * 代价是任何一个窗格改代码都要重发整个 baseui，所以窗格之间不互相 import（见 src/index.ts 头注）。
 */

/** id 与 node 侧 registerPane 登记的一致——两处各写一份，同命令名一样 */
export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  switch (args.pane.id) {
    case 'logger':
      return mountLoggerPane(args, container)
    case 'plugin-manager':
      return mountPluginManagerPane(args, container)
    default:
      container.textContent = `基础界面没有叫 ${args.pane.id} 的窗格`
      return {
        dispose() {
          container.textContent = ''
        },
      }
  }
}
