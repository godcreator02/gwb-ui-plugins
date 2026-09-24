'use client'

/**
 * 一个窗格从注册到关闭：最上面是插件的 node 侧与外壳的注册表，中间是 PluginPane 加载插件浏览器侧代码的三步，
 * 下面是插件在容器里挂载出来的界面与关窗格时的清理。
 */

import { Arrow, Box, Frame } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'plugin' | 'registry' | 'style' | 'import' | 'mount' | 'container' | 'close'

const STEPS: { title: string; detail: string; lit: Part[] }[] = [
  { title: '全貌', detail: '插件注册窗格时只交出两个地址；外壳每次打开这个窗格，都由 PluginPane 按这条顺序加载插件的浏览器侧代码。', lit: [] },
  {
    title: '第 1 步：注册窗格',
    detail: '插件在 apply 里调 ctx.gwbShell.registerPane({ id, title, icon?, client, style?, kind? })。client 与 style 是从 import.meta.url 算出的 file:// 地址；包名与 entryId 由服务从调用方的 fiber 上取，插件报不了别人的。',
    lit: ['plugin', 'registry'],
  },
  {
    title: '第 2 步：打开时取地址',
    detail: 'PluginPane 调 shell.panes 当场取注册表，按 (entryId, 窗格 id) 找到这一条。插件卸载了、或注册时没给 client，就在窗格里显示错误。',
    lit: ['registry', 'style'],
  },
  {
    title: '第 3 步：先注入样式表',
    detail: '给了 style 就注入 <link> 并等到 load 事件再往下走，否则第一帧可能是一堆没有样式的元素。同一张样式表只注入一次，关窗格也不移除。',
    lit: ['style'],
  },
  { title: '第 4 步：动态 import', detail: 'import(client) 取模块导出的 mountPane；没有这个导出、或它不是函数，就报错。', lit: ['import'] },
  {
    title: '第 5 步：挂载',
    detail: '调 mountPane({ host, shell, pane }, 容器)。返回值必须有 dispose；retarget 可选：外壳换这个窗格的 params 时，有它就调它（软换），没有就卸载后重新挂载（硬换）。',
    lit: ['mount', 'container'],
  },
  {
    title: '第 6 步：关窗格',
    detail: '清理时把插件的 dispose 排进微任务、在 React 提交之外调用（插件可以在里面同步卸载自己的 React 树），随后释放窗格间总线的句柄。',
    lit: ['close', 'container'],
  },
]

export function PaneMount() {
  const state = useSteps(STEPS.length, 3400)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const flowing = (from: Part, to: Part) => current.lit.includes(from) && current.lit.includes(to)
  const closing = state.step === 6

  return (
    <>
      <svg viewBox="0 0 400 540" role="img" aria-label="一个窗格从注册到挂载再到关闭">
        <Box x={20} y={12} w={360} h={56} lines={['插件的 node 侧', 'registerPane({ id, client, style })']} tone={lit('plugin')} mono />
        <Arrow from={[200, 68]} to={[200, 94]} tone={lit('plugin')} flow={flowing('plugin', 'registry')} />
        <Box x={20} y={94} w={360} h={56} lines={['外壳的窗格注册表', 'shell.panes 回 { id, client, style, kind, … }']} tone={lit('registry')} mono />
        <Arrow from={[310, 150]} to={[310, 196]} tone={lit('style')} flow={flowing('registry', 'style')} />

        <Frame x={10} y={172} w={380} h={262} label="PluginPane（每个窗格一份）" />
        <Box x={30} y={196} w={340} h={52} lines={['注入 style.css', '等 load 事件']} tone={lit('style')} dashed />
        <Arrow from={[200, 248]} to={[200, 268]} tone={lit('import')} flow={current.lit.includes('import')} />
        <Box x={30} y={268} w={340} h={52} lines={['import(client.js)', '取导出的 mountPane']} tone={lit('import')} mono />
        <Arrow from={[200, 320]} to={[200, 340]} tone={lit('mount')} flow={current.lit.includes('mount')} />
        <Box x={30} y={340} w={340} h={78} lines={['mountPane(args, 容器)', 'args = { host, shell, pane }', '返回 { dispose, retarget? }']} tone={lit('mount')} mono />

        <Box x={20} y={452} w={170} h={70} lines={['插件的界面', '容器：@container', 'data-gwb-plugin']} tone={lit('container')} dim={closing} mono />
        <Box x={210} y={452} w={170} h={70} lines={['关窗格', 'dispose 排进微任务', '再释放总线句柄']} tone={lit('close')} />
        <Arrow from={[105, 418]} to={[105, 452]} tone={lit('container')} flow={current.lit.includes('mount')} />
        <Arrow from={[210, 487]} to={[190, 487]} tone={lit('close')} flow={closing} />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
