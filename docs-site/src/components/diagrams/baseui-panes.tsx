/**
 * 基础界面插件的两个窗格与它们调用的命令：最上面是 baseui 的 node 侧（按装了哪些服务决定注册哪几个窗格），
 * 左列日志窗格，右列插件管理窗格，每列下面是它经 args.host.call 调的命令与命令的提供方。
 */

import { Arrow, Box, Frame, Note } from './parts'

/** 插件管理窗格调的命令，按命令名前缀分组；缩进的行接在上一行的前缀后面 */
const PLUGIN_MANAGER_COMMANDS: [string, boolean][] = [
  ['plugin-manager.', false],
  ['list · outdated', true],
  ['search · install', true],
  ['uninstall', true],
  ['update-all', true],
  ['enable · disable', true],
  ['add-entry', true],
  ['remove-entry', true],
  ['set-label', true],
  ['settings.', false],
  ['all · get · set', true],
  ['delete', true],
  ['shell.plugins', false],
]

export function BaseuiPanes() {
  return (
    <svg viewBox="0 0 400 546" role="img" aria-label="基础界面插件的日志窗格与插件管理窗格各调哪些命令">
      <Box x={20} y={12} w={360} h={72} lines={['基础界面插件 baseui（node 侧）', 'inject: gwbShell', '局部注入 gwbLogger · gwbPluginManager']} mono />
      <Arrow from={[105, 84]} to={[105, 118]} label="装了日志" />
      <Arrow from={[295, 84]} to={[295, 118]} label="装了插件管理" />

      <Box x={20} y={118} w={170} h={56} lines={['日志窗格', "id: 'logger'"]} tone="a" mono />
      <Box x={210} y={118} w={170} h={56} lines={['插件管理窗格', "id: 'plugin-manager'"]} tone="b" mono />

      <Frame x={20} y={190} w={170} h={150} label="调用" />
      <Note x={32} y={232} mono>logger.backlog</Note>
      <Note x={32} y={252} mono>logger.where</Note>
      <Note x={32} y={282} size={11.5}>实时日志不经 host：</Note>
      <Note x={32} y={302} mono>window.gwb.on</Note>
      <Note x={32} y={322} size={11.5}>只收 t = gwb-logger</Note>

      <Frame x={210} y={190} w={170} h={272} label="调用" />
      {PLUGIN_MANAGER_COMMANDS.map(([text, indented], index) => (
        <Note key={text} x={indented ? 234 : 222} y={230 + index * 18} mono size={11.5}>
          {text}
        </Note>
      ))}

      <Arrow from={[105, 340]} to={[105, 360]} />
      <Box x={20} y={360} w={170} h={70} lines={['gwb-logger 插件', '缓冲、查询命令', '事件流']} />
      <Arrow from={[295, 462]} to={[295, 480]} />
      <Box x={210} y={480} w={170} h={56} lines={['提供方', '插件管理 · 设置 · 外壳']} />
      <Note x={20} y={470} size={11.5}>两个窗格互不 import，</Note>
      <Note x={20} y={490} size={11.5}>只共用 components/ui</Note>
      <Note x={20} y={510} size={11.5}>下的组件</Note>
    </svg>
  )
}
