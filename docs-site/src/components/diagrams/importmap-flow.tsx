'use client'

/**
 * react 怎么全页只有一份：内核包打包 react → 页面入口里写死的 importmap → 外壳与插件的 client.js 按包名解析到同一个文件。
 */

import { Arrow, Box } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'bundle' | 'entry' | 'map' | 'shell' | 'plugin' | 'react'

const STEPS: { title: string; detail: string; lit: Part[] }[] = [
  { title: '全貌', detail: 'react 相关的四个包名全页只解析到一份文件：内核包提供，页面入口里的 importmap 负责解析。', lit: [] },
  {
    title: '第 1 步：内核包打包 react',
    detail: '内核包构建时把 react 打成 ESM 放进 dist/react/，和页面入口 index.html 在同一个目录下。',
    lit: ['bundle'],
  },
  {
    title: '第 2 步：页面入口里写死 importmap',
    detail: 'index.html 里有一张写死的 importmap，只有 react、react/jsx-runtime、react-dom、react-dom/client 四个包名，地址相对 index.html 指向 ./react/…。内核启动时不计算、不读任何包清单，页面一加载这张表就在。',
    lit: ['bundle', 'entry', 'map'],
  },
  {
    title: '第 3 步：按包名解析',
    detail: "外壳和各插件的 client.js 构建时都把这四个包名设成 external，产物里留着 import … from 'react'。浏览器按 importmap 把它解析到内核包的 dist/react/react.js——全页同一份 React。",
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
      <svg viewBox="0 0 400 452" role="img" aria-label="react 的四个包名怎么经页面入口里写死的 importmap 解析到内核包提供的同一份文件">
        <Box x={20} y={12} w={360} h={70} lines={['内核包 dist/react/', 'react.js、react-jsx-runtime.js、', 'react-dom.js、react-dom-client.js']} tone={lit('bundle')} mono />
        <Arrow from={[200, 82]} to={[200, 108]} tone={lit('entry')} flow={flowing('bundle', 'entry')} />
        <Box x={20} y={108} w={360} h={56} lines={['内核包 dist/index.html（页面入口）', '同目录，地址写相对路径 ./react/…']} tone={lit('entry')} />
        <Arrow from={[200, 164]} to={[200, 190]} tone={lit('map')} flow={flowing('entry', 'map')} />
        <Box x={20} y={190} w={360} h={70} lines={['写死的 importmap', '"react" → ./react/react.js', '只有这四个包名']} tone={lit('map')} mono />

        <Box x={20} y={300} w={170} h={56} lines={['外壳 client.js', "from 'react'"]} tone={lit('shell')} mono />
        <Box x={210} y={300} w={170} h={56} lines={['插件 client.js', "from 'react'"]} tone={lit('plugin')} mono />
        <Arrow from={[105, 300]} to={[105, 260]} label="按包名解析" tone={lit('shell')} flow={flowing('shell', 'map')} />
        <Arrow from={[295, 300]} to={[295, 260]} tone={lit('plugin')} flow={flowing('plugin', 'map')} />

        <Box x={20} y={384} w={360} h={56} lines={['同一份 React', '内核包里的 dist/react/react.js 只加载一次']} tone={lit('react')} />
        <Arrow from={[105, 356]} to={[105, 384]} tone={lit('react')} />
        <Arrow from={[295, 356]} to={[295, 384]} tone={lit('react')} />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
