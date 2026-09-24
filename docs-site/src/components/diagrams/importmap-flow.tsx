'use client'

/**
 * react 怎么全页只有一份：外壳的包清单声明 → 内核拼 importmap → 页面注入 → 外壳与插件的 client.js 按包名解析到同一个文件。
 */

import { Arrow, Box } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'manifest' | 'kernel' | 'map' | 'shell' | 'plugin' | 'react'

const STEPS: { title: string; detail: string; lit: Part[] }[] = [
  { title: '全貌', detail: 'react 相关的四个包名全页只解析到一份文件：外壳提供，内核转交，页面上的 importmap 负责解析。', lit: [] },
  {
    title: '第 1 步：外壳声明',
    detail: '外壳在 package.json 的 gwb.shared 里写明 react、react/jsx-runtime、react-dom、react-dom/client 四个包名各对应本包的哪个导出子路径（./react 这类，指向 dist/ 下打包好的 ESM）。',
    lit: ['manifest'],
  },
  {
    title: '第 2 步：内核拼 importmap',
    detail: '内核扫 home 里各包的 gwb.shared，把子路径解析成 file:// 地址，拼成一张 importmap。它不认识 react，只转交声明；同一个包名只认第一个声明的包。',
    lit: ['manifest', 'kernel', 'map'],
  },
  { title: '第 3 步：页面注入', detail: '页面在 import 外壳的 client.js 之前注入这张 importmap，整页只注入一次。', lit: ['map'] },
  {
    title: '第 4 步：按包名解析',
    detail: "外壳和各插件的 client.js 构建时都把这四个包名设成 external，产物里留着 import … from 'react'。浏览器按 importmap 把它解析到外壳的 dist/react.js——全页同一份 React。",
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
      <svg viewBox="0 0 400 452" role="img" aria-label="react 的四个包名怎么经 importmap 解析到外壳提供的同一份文件">
        <Box x={20} y={12} w={360} h={70} lines={['外壳 package.json', '"gwb": { "shared": {', '"react": "./react", … } }']} tone={lit('manifest')} mono />
        <Arrow from={[200, 82]} to={[200, 108]} tone={lit('kernel')} flow={flowing('manifest', 'kernel')} />
        <Box x={20} y={108} w={360} h={56} lines={['内核', '扫各包的 gwb.shared → file:// 地址']} tone={lit('kernel')} />
        <Arrow from={[200, 164]} to={[200, 190]} tone={lit('map')} flow={flowing('kernel', 'map')} />
        <Box x={20} y={190} w={360} h={70} lines={['页面上的 importmap', '"react" → file:///…/gwb-shell/', 'dist/react.js'] } tone={lit('map')} mono />

        <Box x={20} y={300} w={170} h={56} lines={['外壳 client.js', "from 'react'"]} tone={lit('shell')} mono />
        <Box x={210} y={300} w={170} h={56} lines={['插件 client.js', "from 'react'"]} tone={lit('plugin')} mono />
        <Arrow from={[105, 300]} to={[105, 260]} label="按包名解析" tone={lit('shell')} flow={flowing('shell', 'map')} />
        <Arrow from={[295, 300]} to={[295, 260]} tone={lit('plugin')} flow={flowing('plugin', 'map')} />

        <Box x={20} y={384} w={360} h={56} lines={['同一份 React', '外壳包里的 dist/react.js 只加载一次']} tone={lit('react')} />
        <Arrow from={[105, 356]} to={[105, 384]} tone={lit('react')} />
        <Arrow from={[295, 356]} to={[295, 384]} tone={lit('react')} />
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}
