import type {
  Acknowledged,
  EntryAdded,
  Installed,
  KernelInstalledButCordisNot,
  OutdatedFound,
  Outcome,
  PluginPackageView,
  SearchFound,
  Uninstalled,
  Updated,
} from '@godcreator/gwb-plugin-manager/receipts'

/**
 * 插件管理各条命令的回执类型，从插件管理的 `./receipts` 子路径 `import type`：两边共用同一套类型，
 * 回执形状对不上由类型检查在构建时报出来，窗格里不再按形状校验。
 * 成功与失败按外层 `ok` 分开；失败只带 `error`，来源可能是插件管理自己、它的「正忙」检查，或命令总线（命令不在、处理函数抛错）
 */

export interface PluginManagerReceipts {
  'plugin-manager.list': Outcome<PluginPackageView[]>
  'plugin-manager.outdated': Outcome<OutdatedFound>
  'plugin-manager.search': Outcome<SearchFound>
  'plugin-manager.install': Outcome<Installed>
  'plugin-manager.uninstall': Outcome<Uninstalled>
  /** 窗格只传 `all` 或 `only`，不会拿到 `KernelInstalledButCordisNot`（只在 `specs` 里有内核包时出现）；它也只按 `error` 显示 */
  'plugin-manager.update': Outcome<Updated> | KernelInstalledButCordisNot
  'plugin-manager.add-entry': Outcome<EntryAdded>
  'plugin-manager.remove-entry': Acknowledged
  'plugin-manager.enable': Acknowledged
  'plugin-manager.disable': Acknowledged
}

export type PluginManagerCommand = keyof PluginManagerReceipts

/** host 只按用到的形状声明 */
export interface CommandHost {
  call: (command: string, args?: unknown) => Promise<unknown>
}

/** `host.call` 的返回在页面这一侧没有类型，这里按命令名换成插件管理声明的回执类型 */
export function callPluginManager<Command extends PluginManagerCommand>(
  host: CommandHost,
  command: Command,
  args?: unknown,
): Promise<PluginManagerReceipts[Command]> {
  return host.call(command, args) as Promise<PluginManagerReceipts[Command]>
}
