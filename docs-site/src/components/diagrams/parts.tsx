/**
 * 示意图共用的组件与常量：颜色、方框、连线、说明文字。颜色全部取站点主题变量与 global.css 里的两种强调色，
 * 深浅主题都跟着走。这里不能标 'use client'：服务端渲染的图要从这里取颜色常量，标了就拿到客户端引用而不是字符串。
 * 带状态的分步播放与图下的分步说明在 steps.tsx。
 *
 * 复制自基础插件仓文档站，字号按本站的窄画布（viewBox 宽 400 左右，手机上缩到约八成）调大了一档。
 */
import type { ReactNode } from 'react'

export const FG = 'var(--color-fd-foreground)'
export const MUTED = 'var(--color-fd-muted-foreground)'
export const BORDER = 'var(--color-fd-border)'
export const BG = 'var(--color-fd-background)'
export const MONO = 'var(--font-mono, monospace)'

export type Tone = 'a' | 'b'

export function toneStroke(tone?: Tone): string {
  return tone === undefined ? MUTED : `var(--diagram-${tone})`
}

export function toneFill(tone?: Tone): string {
  return tone === undefined ? BG : `var(--diagram-${tone}-soft)`
}

const FADE = 'fill 400ms ease, stroke 400ms ease, opacity 400ms ease'
const LINE_GAP = 17

/** 方框：第一行加粗当标题，其余行弱化；dashed 画虚线框（可选的、还没出现的东西）；dim 把整框调淡 */
export function Box({ x, y, w, h, lines, tone, dashed, mono, dim }: { x: number; y: number; w: number; h: number; lines: string[]; tone?: Tone; dashed?: boolean; mono?: boolean; dim?: boolean }) {
  const top = y + h / 2 - ((lines.length - 1) * LINE_GAP) / 2
  return (
    <g style={{ opacity: dim ? 0.35 : 1, transition: FADE }}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={toneFill(tone)} stroke={toneStroke(tone)} strokeWidth={1.2} strokeDasharray={dashed ? '5 4' : undefined} style={{ transition: FADE }} />
      {lines.map((line, index) => (
        <text
          key={`${index}-${line}`}
          x={x + w / 2}
          y={top + index * LINE_GAP}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={index === 0 ? 13.5 : 12}
          fontWeight={index === 0 ? 600 : 400}
          fill={index === 0 ? FG : MUTED}
          fontFamily={mono && index > 0 ? MONO : undefined}
        >
          {line}
        </text>
      ))}
    </g>
  )
}

function arrowHead(from: [number, number], to: [number, number]): string {
  const [x1, y1] = from
  const [x2, y2] = to
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 7
  const left: [number, number] = [x2 - head * Math.cos(angle - 0.4), y2 - head * Math.sin(angle - 0.4)]
  const right: [number, number] = [x2 - head * Math.cos(angle + 0.4), y2 - head * Math.sin(angle + 0.4)]
  return `${x2},${y2} ${left[0]},${left[1]} ${right[0]},${right[1]}`
}

/** 带箭头的直线；label 写在线的中点旁边；flow 让线上的虚线沿箭头方向移动（global.css 的 .diagram-flow，减少动态效果时停住） */
export function Arrow({ from, to, label, dashed, tone, flow, labelAt = 'above' }: { from: [number, number]; to: [number, number]; label?: string; dashed?: boolean; tone?: Tone; flow?: boolean; labelAt?: 'above' | 'below' }) {
  const [x1, y1] = from
  const [x2, y2] = to
  const color = toneStroke(tone)
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  return (
    <g style={{ transition: FADE }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={flow ? 1.6 : 1.2} strokeDasharray={dashed ? '4 4' : undefined} className={flow ? 'diagram-flow' : undefined} />
      <polygon points={arrowHead(from, to)} fill={color} />
      {label !== undefined && (
        <text
          x={(x1 + x2) / 2 + (vertical ? 7 : 0)}
          y={(y1 + y2) / 2 + (vertical ? 4 : labelAt === 'above' ? -6 : 15)}
          textAnchor={vertical ? 'start' : 'middle'}
          fontSize={11.5}
          fill={tone === undefined ? MUTED : color}
        >
          {label}
        </text>
      )}
    </g>
  )
}

/** 折线箭头：按 points 依次连起来，箭头画在最后一段的末端；label 写在 labelAt 指定的位置 */
export function Elbow({ points, label, labelAt, tone, flow, dashed }: { points: [number, number][]; label?: string; labelAt?: [number, number]; tone?: Tone; flow?: boolean; dashed?: boolean }) {
  const color = toneStroke(tone)
  const last = points[points.length - 1]!
  const beforeLast = points[points.length - 2]!
  return (
    <g style={{ transition: FADE }}>
      <polyline points={points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={color} strokeWidth={flow ? 1.6 : 1.2} strokeDasharray={dashed ? '4 4' : undefined} className={flow ? 'diagram-flow' : undefined} />
      <polygon points={arrowHead(beforeLast, last)} fill={color} />
      {label !== undefined && labelAt !== undefined && (
        <text x={labelAt[0]} y={labelAt[1]} fontSize={11.5} fill={tone === undefined ? MUTED : color}>
          {label}
        </text>
      )}
    </g>
  )
}

/** 一段普通说明文字 */
export function Note({ x, y, children, anchor = 'start', size = 12, color = MUTED, weight, mono }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number; color?: string; weight?: number; mono?: boolean }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color} fontWeight={weight} fontFamily={mono ? MONO : undefined}>
      {children}
    </text>
  )
}

/** 分界线：一条横向或纵向虚线，旁边一句这条线两边各不知道什么 */
export function SeamLine({ x1, y1, x2, y2, label, labelX, labelY, anchor = 'end' }: { x1: number; y1: number; x2: number; y2: number; label: string; labelX: number; labelY: number; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={MUTED} strokeWidth={1} strokeDasharray="6 5" />
      <text x={labelX} y={labelY} textAnchor={anchor} fontSize={11.5} fill={MUTED}>
        {label}
      </text>
    </g>
  )
}

/** 外框：圈住同一个进程、插件或文件里的几样东西，左上角写名字；lit 时框线换成强调色，dashed 画虚线框 */
export function Frame({ x, y, w, h, label, lit, dashed }: { x: number; y: number; w: number; h: number; label: string; lit?: boolean; dashed?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke={lit ? 'var(--diagram-a)' : BORDER} strokeWidth={lit ? 1.4 : 1} strokeDasharray={dashed ? '6 4' : undefined} style={{ transition: FADE }} />
      <text x={x + 10} y={y + 18} fontSize={12.5} fontWeight={600} fill={FG}>
        {label}
      </text>
    </g>
  )
}
