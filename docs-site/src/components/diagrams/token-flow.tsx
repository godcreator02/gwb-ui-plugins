'use client'

/**
 * 颜色令牌从哪来：上半是构建时（外壳的映射文件 → 插件的样式入口 → 带前缀的类），
 * 下半是运行时（页面上的令牌表 → 插件元素读到的值）。
 */

import { Arrow, Box, Frame, Note } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'reference' | 'entry' | 'output' | 'tokens' | 'element' | 'dark'

const STEPS: { title: string; detail: string; lit: Part[] }[] = [
  { title: '全貌', detail: '插件的样式规则里只写 var(--primary) 这类变量引用；变量的值全页只有一份，写在外壳注入的令牌表里。', lit: [] },
  {
    title: '第 1 步：映射文件',
    detail: '外壳包里的 theme.reference.css 用 @theme inline 把 Tailwind 的颜色名映射到令牌变量（--color-primary: var(--primary)），它本身不输出任何变量值。',
    lit: ['reference'],
  },
  {
    title: '第 2 步：插件构建',
    detail: '插件的样式入口引入这个映射文件，并在 Tailwind 主题导入上写 prefix(baseui)。编出的类名带插件前缀，规则里只有变量引用：.baseui\\:bg-primary { background-color: var(--primary) }。',
    lit: ['reference', 'entry', 'output'],
  },
  {
    title: '第 3 步：页面上的值',
    detail: '外壳开机最先注入令牌表 tokens.css：亮色的值写在 :root，暗色的值写在 .dark（<html> 上的类）。',
    lit: ['tokens'],
  },
  {
    title: '第 4 步：元素读到值',
    detail: '插件元素上的 baseui:bg-primary 读 var(--primary)，CSS 变量沿 DOM 继承，读到的是页面上那一份。',
    lit: ['output', 'tokens', 'element'],
  },
  {
    title: '第 5 步：切换亮暗',
    detail: '状态栏的亮暗开关只切换 <html> 上的 dark 类，令牌表里 .dark 那套值生效，所有插件一起变，不用重新构建任何插件。',
    lit: ['dark', 'tokens', 'element'],
  },
]

export function TokenFlow() {
  const state = useSteps(STEPS.length, 3400)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const both = (a: Part, b: Part) => current.lit.includes(a) && current.lit.includes(b)
  const dark = current.lit.includes('dark')

  return (
    <>
      <svg viewBox="0 0 400 486" role="img" aria-label="颜色令牌在构建时与运行时各经过哪几处">
        <Frame x={10} y={8} w={380} h={232} label="构建时（插件自己的 Tailwind）" />
        <Box x={24} y={36} w={352} h={56} lines={['外壳 theme.reference.css', '--color-primary: var(--primary)']} tone={lit('reference')} mono />
        <Arrow from={[200, 92]} to={[200, 108]} tone={lit('entry')} flow={both('reference', 'entry')} />
        <Box x={24} y={108} w={352} h={56} lines={['插件的样式入口 styles.css', 'prefix(baseui) + 引入映射文件']} tone={lit('entry')} mono />
        <Arrow from={[200, 164]} to={[200, 180]} tone={lit('output')} flow={both('entry', 'output')} />
        <Box x={24} y={180} w={352} h={50} lines={['插件的 style.css（产物）', '.baseui\\:bg-primary → var(--primary)']} tone={lit('output')} mono />

        <Frame x={10} y={256} w={380} h={222} label="运行时（页面）" />
        <Box x={24} y={284} w={150} h={80} lines={['插件的元素', 'baseui:bg-primary']} tone={lit('element')} mono />
        <Box x={214} y={284} w={162} h={80} lines={['令牌表 tokens.css', ':root → 亮色值', '.dark → 暗色值']} tone={lit('tokens')} mono />
        <Arrow from={[214, 324]} to={[174, 324]} tone={both('tokens', 'element') ? 'a' : undefined} flow={both('tokens', 'element')} />
        <Box x={214} y={392} w={162} h={72} lines={['<html>', dark ? 'class="dark"' : '亮暗开关', '切换 dark 类']} tone={lit('dark')} mono />
        <Arrow from={[295, 392]} to={[295, 364]} tone={lit('dark')} flow={dark} />
        <Note x={24} y={400}>元素里的 var(--primary)</Note>
        <Note x={24} y={420}>沿 DOM 继承，读到页面上</Note>
        <Note x={24} y={440}>令牌表里的那一份值</Note>
        <Arrow from={[150, 230]} to={[150, 284]} tone={both('output', 'element') ? 'a' : undefined} dashed />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
