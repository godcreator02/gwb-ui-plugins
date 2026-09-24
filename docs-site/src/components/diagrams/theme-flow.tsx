'use client'

/**
 * 主题插件的外观设置从哪来、怎么进页面：上面是设置与主题插件的 node 侧，中间是外壳转交与页面上那张启动样式表，
 * 下面左边是状态栏的亮暗开关（不经过主题插件），右边是「外观」窗格（右侧那条折线是它调主题插件的两条命令）。
 */

import { Arrow, Box, Elbow } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'settings' | 'theme' | 'shell' | 'page' | 'pane' | 'status' | 'html'
type Flow = 'read' | 'write' | 'startup' | 'inject' | 'preview' | 'values' | 'toggle'

const STEPS: { title: string; detail: string; lit: Part[]; flows: Flow[] }[] = [
  {
    title: '全貌',
    detail: '主题插件管三项外观设置（正文字体、等宽字体、自定义 CSS），把它们拼成一段 CSS 交给外壳，注入在页面上所有样式表之后。亮暗切换是另一件事，由外壳的状态栏切换 <html> 上的 dark 类。',
    lit: [],
    flows: [],
  },
  {
    title: '第 1 步：值存在设置里',
    detail: '主题插件用 gwbSettings 定义 font-sans、font-mono、custom-css 三项，存在这个 home 里；空串表示没设。',
    lit: ['settings', 'theme'],
    flows: ['read'],
  },
  {
    title: '第 2 步：开机拼成一段 CSS',
    detail: '外壳 node 侧处理 shell.env 时，先看命令表里有没有 theme.startupCss，有才调。主题插件用 buildStartupCss 拼出 CSS：字体写成 :root 里的 --gwb-font-sans / --gwb-font-mono，自定义 CSS 原样接在后面。',
    lit: ['theme', 'shell'],
    flows: ['startup'],
  },
  {
    title: '第 3 步：注入页面',
    detail: '外壳浏览器侧把它写进 <style id="gwb-theme-style">，排在三张样式表之后、第一帧之前。它不在任何 @layer 里，所以能覆盖令牌的默认值和插件的工具类。',
    lit: ['shell', 'page'],
    flows: ['inject'],
  },
  {
    title: '第 4 步：在「外观」窗格里改',
    detail: '窗格打开时调 theme.values 取当前值；每次输入都用同一个 buildStartupCss 重算，直接改写 #gwb-theme-style，当场预览。',
    lit: ['pane', 'theme', 'page'],
    flows: ['values', 'preview'],
  },
  {
    title: '第 5 步：保存或放弃',
    detail: '点保存调 theme.save 写回三项设置，重启后照此生效；不保存就关窗格，页面退回已保存的样子。',
    lit: ['pane', 'theme', 'settings'],
    flows: ['values', 'write'],
  },
  {
    title: '亮暗切换',
    detail: '状态栏的亮暗开关只切换 <html> 上的 dark 类，令牌表里 .dark 那套值随之生效；它不经过主题插件。',
    lit: ['status', 'html'],
    flows: ['toggle'],
  },
]

export function ThemeFlow() {
  const state = useSteps(STEPS.length, 3400)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const on = (flow: Flow) => current.flows.includes(flow)
  const tone = (flow: Flow) => (on(flow) ? 'a' : undefined)

  return (
    <>
      <svg viewBox="0 0 400 470" role="img" aria-label="外观设置怎么变成页面上的启动样式，亮暗开关又走哪条路">
        <Box x={20} y={12} w={170} h={86} lines={['gwbSettings', 'font-sans', 'font-mono', 'custom-css']} tone={lit('settings')} mono />
        <Box x={210} y={12} w={170} h={86} lines={['主题插件 node 侧', 'theme.startupCss', 'theme.values', 'theme.save']} tone={lit('theme')} mono />
        {on('write') ? (
          <Arrow from={[210, 55]} to={[190, 55]} tone="a" flow />
        ) : (
          <Arrow from={[190, 55]} to={[210, 55]} tone={tone('read')} flow={on('read')} />
        )}

        <Box x={210} y={126} w={170} h={56} lines={['外壳 node 侧', 'shell.env 带上它']} tone={lit('shell')} />
        <Arrow from={[295, 98]} to={[295, 126]} tone={tone('startup')} flow={on('startup')} />

        <Box x={20} y={212} w={360} h={60} lines={['<style id="gwb-theme-style">', '三张样式表之后 · 第一帧之前 · 不分层']} tone={lit('page')} mono />
        <Arrow from={[295, 182]} to={[295, 212]} tone={tone('inject')} flow={on('inject')} />

        <Box x={210} y={306} w={170} h={70} lines={['「外观」窗格', '输入即预览', '保存 / 关窗格退回']} tone={lit('pane')} />
        <Arrow from={[295, 306]} to={[295, 272]} label="预览" tone={tone('preview')} flow={on('preview')} />
        <Elbow points={[[380, 341], [394, 341], [394, 55], [380, 55]]} tone={tone('values')} flow={on('values')} />

        <Box x={20} y={306} w={170} h={70} lines={['状态栏', '亮暗开关']} tone={lit('status')} />
        <Arrow from={[105, 376]} to={[105, 404]} tone={tone('toggle')} flow={on('toggle')} />
        <Box x={20} y={404} w={360} h={56} lines={['<html class="dark">', '令牌表 tokens.css 里 .dark 那套值生效']} tone={lit('html')} mono />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
