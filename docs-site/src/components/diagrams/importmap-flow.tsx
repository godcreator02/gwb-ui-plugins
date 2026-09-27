'use client'

/**
 * react 怎么全页只有一份：shell 打包 React → preload 准备的 importmap → 外壳与插件的 client.js 按包名解析到同一个文件。
 */

import { Arrow, Box } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'bundle' | 'entry' | 'map' | 'shell' | 'plugin' | 'react'

const STEPS: { title: string; detail: string; lit: Part[] }[] = [
  { title: '全貌', detail: 'react 相关的四个包名全页只解析到一份文件：shell 提供，页面入口里的 importmap 负责解析。', lit: [] },
  {
    title: '第 1 步：shell 打包 React',
    detail: 'shell 将 React 打成 ESM 放进自己的 dist/react/，纯代码 browserImports() 返回这些文件的 URL。',
    lit: ['bundle'],
  },
  {
    title: '第 2 步：登记并准备 importmap',
    detail: 'shell 先 registerImports(browserImports())，再 setShell。页面 await prepareImports()，preload 拉取登记快照并注入。其他插件也可提供自己的名字。',
    lit: ['bundle', 'entry', 'map'],
  },
  {
    title: '第 3 步：按包名解析',
    detail: "外壳和各插件的 client.js 构建时都把这四个包名设成 external，产物里留着 import … from 'react'。浏览器按 importmap 把它解析到shell 的 dist/react/react.js——全页同一份 React。",
    lit: ['shell', 'plugin', 'react', 'map'],
  },
]

export function ImportmapFlow() {
  const state = useSteps(STEPS.length, 3400)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const flowing = (a: Part, b: Part) => current.lit.includes(a) && current.lit.includes(b)

  return (
    <>
      <svg viewBox="0 0 400 452" role="img" aria-label="react 的四个包名怎么经preload 准备的 importmap 解析到shell 提供的同一份文件">
        <Box x={20} y={12} w={360} h={70} lines={['shell dist/react/', 'react.js、react-jsx-runtime.js、', 'react-dom.js、react-dom-client.js']} tone={lit('bundle')} mono />
        <Arrow from={[200, 82]} to={[200, 108]} tone={lit('entry')} flow={flowing('bundle', 'entry')} />
        <Box x={20} y={108} w={360} h={56} lines={['registerImports(browserImports())', '名字 → shell 产物的 file URL']} tone={lit('entry')} />
        <Arrow from={[200, 164]} to={[200, 190]} tone={lit('map')} flow={flowing('entry', 'map')} />
        <Box x={20} y={190} w={360} h={70} lines={['prepareImports() 后的 importmap', '"react" → shell 的 react.js', '准备完成再加载模块']} tone={lit('map')} mono />

        <Box x={20} y={300} w={170} h={56} lines={['外壳 client.js', "from 'react'"]} tone={lit('shell')} mono />
        <Box x={210} y={300} w={170} h={56} lines={['插件 client.js', "from 'react'"]} tone={lit('plugin')} mono />
        <Arrow from={[105, 300]} to={[105, 260]} label="按包名解析" tone={lit('shell')} flow={flowing('shell', 'map')} />
        <Arrow from={[295, 300]} to={[295, 260]} tone={lit('plugin')} flow={flowing('plugin', 'map')} />

        <Box x={20} y={384} w={360} h={56} lines={['同一份 React', 'shell 的 dist/react/react.js 只加载一次']} tone={lit('react')} />
        <Arrow from={[105, 356]} to={[105, 384]} tone={lit('react')} />
        <Arrow from={[295, 356]} to={[295, 384]} tone={lit('react')} />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
