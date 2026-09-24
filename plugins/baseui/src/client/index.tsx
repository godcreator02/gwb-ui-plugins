import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import { mountPane as mountLoggerPane } from './panes/logger/index'
import { mountPane as mountPluginManagerPane } from './panes/plugin-manager/index'

/** 两个窗格共用这份 client.js 与 style.css，按 `pane.id` 分派；id 与 node 侧 registerPane 登记的各写一份 */
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
