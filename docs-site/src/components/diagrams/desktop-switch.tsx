'use client'

/**
 * 切桌面：左右两张桌面各是一个 section（窗格容器 + 这张桌面的浮层挂载点），下面是状态栏与 body。
 * 插件的下拉菜单挂在桌面 1 的浮层挂载点里，所以桌面 1 藏起来时菜单跟着藏。
 */

import { Arrow, Box, Frame, Note } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'menu' | 'status' | 'save' | 'body' | 'notify'

const STEPS: { title: string; detail: string; active: 1 | 2; lit: Part[] }[] = [
  {
    title: '全貌',
    detail: '每张桌面是一个 section：窗格容器加这张桌面的浮层挂载点。不显示的那张加 visibility:hidden、pointer-events:none 与 inert——不显示、不能操作，但 DOM、定时器、订阅都还在。',
    active: 1,
    lit: [],
  },
  {
    title: '插件的浮层放在自己那张桌面里',
    detail: '插件把 radix Portal 的 container 设成 args.shell.portal，下拉菜单、确认框的 DOM 就在这张桌面的 section 里，桌面藏起来时跟着一起藏。',
    active: 1,
    lit: ['menu'],
  },
  {
    title: '切换：先保存',
    detail: '在状态栏「桌面」面板里点桌面 2：先把 active 改成桌面 2，立刻把整份布局保存一次（两个容器此刻都在，读到的都是当下的布局）。',
    active: 1,
    lit: ['status', 'save'],
  },
  {
    title: '显示与隐藏交给 React',
    detail: '桌面 1 连同它的浮层藏起来，桌面 2 显示；桌面 2 的容器没挂载过的话，这时才挂载。',
    active: 2,
    lit: [],
  },
  {
    title: '可见性通知与焦点',
    detail: '通过 args.shell.onVisibility 订阅的插件：桌面 1 上的收到 false，桌面 2 上的收到 true，可以据此暂停或恢复渲染。键盘焦点交给桌面 2 的 section。',
    active: 2,
    lit: ['notify'],
  },
  {
    title: '500ms 后检查 body',
    detail: '检查 body 下 #root 以外的节点，只在 console 里报告、不删除：挂在 body 上的浮层不属于任何桌面、藏不掉，说明那个插件没用 args.shell.portal。',
    active: 2,
    lit: ['body'],
  },
]

function Desk({ x, index, shown, menuLit, notify }: { x: number; index: 1 | 2; shown: boolean; menuLit: boolean; notify: boolean }) {
  return (
    <g style={{ opacity: shown ? 1 : 0.4, transition: 'opacity 400ms ease' }}>
      <Frame x={x} y={8} w={185} h={214} label={`桌面 ${index}`} lit={shown} />
      <Note x={x + 175} y={26} anchor="end" size={11.5}>
        {shown ? '显示' : 'hidden · inert'}
      </Note>
      <Box x={x + 10} y={36} w={165} h={70} lines={notify ? ['窗格容器', 'dockview', `onVisibility → ${shown}`] : ['窗格容器', 'dockview']} mono tone={notify ? 'a' : undefined} />
      <Frame x={x + 10} y={116} w={165} h={96} label="浮层挂载点" dashed />
      {index === 1 && <Box x={x + 22} y={148} w={141} h={52} lines={['插件的下拉菜单', 'Portal → portal']} tone={menuLit ? 'a' : undefined} mono />}
    </g>
  )
}

export function DesktopSwitch() {
  const state = useSteps(STEPS.length, 3400)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)

  return (
    <>
      <svg viewBox="0 0 400 350" role="img" aria-label="两张桌面怎么切换、浮层为什么放在各自的桌面里">
        <Desk x={10} index={1} shown={current.active === 1} menuLit={current.lit.includes('menu')} notify={current.lit.includes('notify')} />
        <Desk x={205} index={2} shown={current.active === 2} menuLit={false} notify={current.lit.includes('notify')} />

        <Box x={10} y={236} w={380} h={46} lines={['状态栏', current.lit.includes('save') ? '「桌面」面板：点桌面 2 → 先保存布局' : '在所有桌面之外，始终可以点']} tone={lit('status')} />
        {current.lit.includes('save') && <Arrow from={[300, 236]} to={[300, 222]} tone="a" flow />}
        <Box x={10} y={294} w={380} h={46} lines={['body 下 #root 以外的节点', '切换 500ms 后检查：只报告，不删除']} tone={lit('body')} dashed />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
