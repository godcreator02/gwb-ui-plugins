'use client'

/**
 * 按位置隔离与按名字隔离对比：上面是插件的一条样式规则，下面是页面 DOM——窗格容器里的按钮，
 * 和 portal 到 body 下的下拉菜单。两步分别是两种隔离方式下这两个元素匹配不匹配得上。
 */

import { Box, Frame } from './parts'
import { StepControls, StepText, useSteps } from './steps'

const STEPS: { title: string; detail: string; byName: boolean }[] = [
  {
    title: '按位置隔离（本仓不用）',
    detail: '把规则改写成「只匹配 data-gwb-plugin 为 baseui 的容器底下的元素」。窗格里的按钮匹配得上；下拉菜单 portal 到 body 下，不在那个容器底下，整层没有样式，而且不报错。',
    byName: false,
  },
  {
    title: '按名字隔离（本仓的做法）',
    detail: '类名从源头带插件前缀（baseui:px-2），编出的规则是 .baseui\\:px-2，全页有效。按钮和 portal 出去的菜单都匹配得上；别的插件不会写出这个类名，所以不会误匹配。',
    byName: true,
  },
]

export function NameIsolation() {
  const state = useSteps(STEPS.length, 4200)
  const current = STEPS[state.step]!
  const byName = current.byName

  return (
    <>
      <svg viewBox="0 0 400 356" role="img" aria-label="按位置隔离与按名字隔离时，portal 出去的菜单有没有样式">
        <Box x={20} y={12} w={360} h={56} lines={['baseui 样式表里的一条规则', byName ? '.baseui\\:px-2 { … }' : '[data-gwb-plugin="baseui"] .px-2']} tone="a" mono />

        <Frame x={10} y={86} w={380} h={262} label="页面 DOM" />
        <Frame x={24} y={112} w={352} h={104} label='窗格容器 data-gwb-plugin="baseui"' />
        <Box x={40} y={144} w={320} h={60} lines={['窗格里的按钮', byName ? 'class="baseui:px-2" → 匹配' : 'class="px-2" → 匹配']} tone="a" mono />
        <Frame x={24} y={230} w={352} h={104} label="body 下（portal 出去的浮层）" />
        <Box
          x={40}
          y={262}
          w={320}
          h={60}
          lines={['下拉菜单', byName ? 'class="baseui:px-2" → 匹配' : 'class="px-2" → 匹配不上']}
          tone={byName ? 'a' : 'b'}
          dashed={!byName}
          mono
        />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
