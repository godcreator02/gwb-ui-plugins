'use client'

/**
 * 分步动画的状态、控制按钮与图下的分步说明：自动播放，每隔一段时间走一步，走到头从 0 再来；
 * 系统设置了减少动态效果时不自动播放。复制自基础插件仓文档站，另加了 StepText。
 */

import { useEffect, useState } from 'react'

export function useSteps(count: number, intervalMs = 2600) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false)
  }, [])
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setStep((value) => (value + 1) % count), intervalMs)
    return () => window.clearInterval(timer)
  }, [playing, count, intervalMs])
  return { step, setStep, playing, setPlaying }
}

/** 图下的三个按钮：上一步、下一步、暂停 / 自动播放，右边写当前是第几步 */
export function StepControls({ count, state }: { count: number; state: ReturnType<typeof useSteps> }) {
  const { step, setStep, playing, setPlaying } = state
  return (
    <div className="diagram-controls">
      <button type="button" onClick={() => { setPlaying(false); setStep((value) => Math.max(0, value - 1)) }}>
        上一步
      </button>
      <button type="button" onClick={() => { setPlaying(false); setStep((value) => Math.min(count - 1, value + 1)) }}>
        下一步
      </button>
      <button type="button" aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>
        {playing ? '暂停' : '自动播放'}
      </button>
      <span className="diagram-counter">
        {step + 1} / {count}
      </span>
    </div>
  )
}

/**
 * 这一步的标题与说明。写成 HTML 而不是 SVG 里的文字：窄屏上照常换行，字号也不跟着图一起缩小。
 * 不加 aria-live：自动播放时每隔几秒换一次，读屏软件会一直被打断；同样的内容在图下的文字说明里都有。
 */
export function StepText({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="diagram-step">
      <p className="diagram-step-title">{title}</p>
      <p>{detail}</p>
    </div>
  )
}
