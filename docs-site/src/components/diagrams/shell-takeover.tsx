'use client'

/**
 * 外壳接管页面：上面是主进程（shell 插件的 node 侧与内核），下面是页面（内核的 index.html、外壳的 client.js、#root）。
 * 左边那条折线是 client.js 回头调 `shell.env` 取环境。
 */

import { Arrow, Box, Elbow, Frame, Note } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'shell' | 'kernel' | 'page' | 'mount' | 'boot' | 'root'
type Flow = 'setShell' | 'push' | 'import' | 'env' | 'boot' | 'render' | 'revoke'

const STEPS: { title: string; detail: string; lit: Part[]; flows: Flow[]; gone?: boolean }[] = [
  { title: '全貌', detail: '外壳是一个普通插件：node 侧告诉内核「页面归我」，浏览器侧的 client.js 被页面 import 后接管 #root。内核只转交地址，不认识外壳里的任何东西；react 的 importmap 写死在内核的页面入口里。', lit: [], flows: [] },
  { title: '第 1 步：shell 插件声明自己是外壳', detail: 'node 侧加载时调 gwbKernel.setShell(client.js 的 file:// 地址)，包在 ctx.effect 里——插件卸载时自动撤销。', lit: ['shell', 'kernel'], flows: ['setShell'] },
  { title: '第 2 步：内核把地址推给页面', detail: '内核记下这个地址，经 gwb:shell 推给页面。', lit: ['kernel', 'page'], flows: ['push'] },
  { title: '第 3 步：页面加载外壳', detail: '页面 import client.js（importmap 在页面入口里本来就有），把 #root 交给它的默认导出 mountShell，留下返回的 dispose。', lit: ['page', 'mount'], flows: ['import'] },
  { title: '第 4 步：取环境', detail: 'mountShell 调 shell.env（经 window.gwb.command 回到 node 侧），拿到 home、三张样式表的地址、主题插件的启动样式与版本号。', lit: ['mount', 'shell'], flows: ['env'] },
  { title: '第 5 步：准备完再挂载', detail: 'bootShell 按顺序注入令牌表、dockview 样式表、外壳样式表并等加载完成，再注入启动样式；取注册表（shell.panes）与布局文件（shell.layout.get）；最后给 <html> 加 dark 类，createRoot(#root) 渲染。', lit: ['boot', 'root'], flows: ['boot', 'render'] },
  { title: '第 6 步：外壳卸载', detail: 'shell 插件卸载时 setShell 的撤销函数执行，内核推 url 为 null；页面调 dispose，外壳同步卸载 React 树，页面回到内核的只读状态页。', lit: ['kernel', 'page'], flows: ['revoke'], gone: true },
]

export function ShellTakeover() {
  const state = useSteps(STEPS.length, 3400)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const on = (flow: Flow) => current.flows.includes(flow)
  const gone = current.gone === true

  return (
    <>
      <svg viewBox="0 0 400 420" role="img" aria-label="外壳怎么接管内核的页面">
        <Frame x={30} y={8} w={360} h={104} label="主进程" />
        <Box x={40} y={38} w={150} h={60} lines={['shell 插件', 'node 侧']} tone={lit('shell')} dashed={gone} dim={gone} />
        <Box x={230} y={38} w={150} h={60} lines={['内核', gone ? '外壳地址：null' : '记下外壳地址']} tone={lit('kernel')} />
        <Arrow from={[190, 68]} to={[230, 68]} label="setShell" tone={on('setShell') || on('revoke') ? 'a' : undefined} flow={on('setShell')} dashed={on('revoke')} />

        <Arrow from={[270, 98]} to={[270, 176]} label="gwb:shell" tone={on('push') || on('revoke') ? 'a' : undefined} flow={on('push') || on('revoke')} />
        <Note x={277} y={158}>{on('revoke') ? 'url: null' : 'url'}</Note>

        <Frame x={30} y={130} w={360} h={282} label="页面" />
        <Box x={40} y={176} w={340} h={52} lines={['内核的页面 index.html', gone ? '调 dispose → 只读状态页' : '写死的 importmap · import(url)']} tone={lit('page')} />
        <Arrow from={[115, 228]} to={[115, 262]} tone={on('import') ? 'a' : undefined} flow={on('import')} />
        <Box x={40} y={262} w={150} h={60} lines={['mountShell(#root)', 'client.js 默认导出']} tone={lit('mount')} dim={gone} />
        <Box x={230} y={262} w={150} h={60} lines={['bootShell', '样式表 · 注册表 · 布局']} tone={lit('boot')} dim={gone} />
        <Arrow from={[190, 292]} to={[230, 292]} tone={on('boot') ? 'a' : undefined} flow={on('boot')} />
        <Arrow from={[305, 322]} to={[305, 346]} tone={on('render') ? 'a' : undefined} flow={on('render')} />
        <Box x={40} y={346} w={340} h={54} lines={['#root', gone ? '（外壳已卸载）' : '窗格容器 + 状态栏的 React 树']} tone={lit('root')} dim={gone} />

        <Elbow points={[[40, 296], [14, 296], [14, 80], [40, 80]]} tone={on('env') ? 'a' : undefined} flow={on('env')} />
        <Note x={44} y={249} color={on('env') ? 'var(--diagram-a)' : undefined}>shell.env</Note>
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
