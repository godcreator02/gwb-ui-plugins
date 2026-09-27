/**
 * 外壳几张分步讲解共用的画法：横向几条泳道（主进程、页面），泳道里是参与者方块，方块之间是这一步走过的箭头。
 * 只管画，不带讲解文字；每张分步讲解把自己的参与者、泳道、箭头坐标交进来，再说这一步亮哪几个参与者、画哪几条箭头。
 * 下面的代码卡片（CodeBlock）也放在这里：分步讲解在画面下方给出这一步对应的源码。
 */
import type { JSX } from 'react';
import { CodeLines, Pane } from '@godcreator/explainer-player';
import type { Role } from '@godcreator/explainer-player';
import './lanes.css';

export type Point = [number, number];

export interface LaneBand {
  label: string;
  y: number;
  h: number;
}

export interface LaneActor {
  id: string;
  name: string;
  sub: string;
  role: Role;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaneFlow {
  id: string;
  points: Point[];
  label?: string;
  /** 文字的锚点；不给就放在第一段的中点 */
  labelAt?: Point;
}

/** 折线在拐角处用圆角连起来 */
function roundedPath(points: Point[], r = 6): string {
  const [first, ...rest] = points;
  if (first === undefined) throw new Error('箭头至少要两个点');
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < rest.length; i++) {
    const [x, y] = rest[i]!;
    const next = rest[i + 1];
    if (next === undefined) {
      d += ` L${x},${y}`;
      break;
    }
    const [px, py] = i === 0 ? first : rest[i - 1]!;
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(next[0] - x, next[1] - y);
    const cut = Math.min(r, inLen / 2, outLen / 2);
    d += ` L${x - ((x - px) / inLen) * cut},${y - ((y - py) / inLen) * cut} Q${x},${y} ${x + ((next[0] - x) / outLen) * cut},${y + ((next[1] - y) / outLen) * cut}`;
  }
  return d;
}

function arrowHead(from: Point, tip: Point): string {
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const bx = tip[0] - ux * 8;
  const by = tip[1] - uy * 8;
  return `${tip[0]},${tip[1]} ${bx - uy * 4},${by + ux * 4} ${bx + uy * 4},${by - ux * 4}`;
}

function flowLabelAt(flow: LaneFlow): Point {
  if (flow.labelAt !== undefined) return flow.labelAt;
  const [a, b] = flow.points;
  return [(a![0] + b![0]) / 2, (a![1] + b![1]) / 2 - 6];
}

/**
 * 泳道图。`lit` 是这一步亮着的参与者（空表示都不淡化），`shown` 是这一步画出来的箭头；
 * `marks` 给个别参与者换一行副标题（比如 #root 此刻显示什么）。
 */
export function Lanes({
  view,
  bands,
  actors,
  flows,
  lit,
  shown,
  marks = {},
  label,
}: {
  view: { w: number; h: number };
  bands: readonly LaneBand[];
  actors: readonly LaneActor[];
  flows: readonly LaneFlow[];
  lit: readonly string[];
  shown: readonly string[];
  marks?: Readonly<Record<string, string>>;
  label: string;
}): JSX.Element {
  const litSet = new Set(lit);
  const shownSet = new Set(shown);
  for (const id of shown) if (!flows.some((f) => f.id === id)) throw new Error(`泳道图里没有箭头「${id}」`);
  for (const id of lit) if (!actors.some((a) => a.id === id)) throw new Error(`泳道图里没有参与者「${id}」`);
  return (
    <div className="sl-scroll">
      <svg className="sl-svg" viewBox={`0 0 ${view.w} ${view.h}`} role="img" aria-label={label} style={{ minWidth: Math.min(view.w, 640) }}>
        {bands.map((band) => (
          <g key={band.label} className="sl-band">
            <rect x={4} y={band.y} width={view.w - 8} height={band.h} rx={12} />
            <text x={16} y={band.y + 18}>
              {band.label}
            </text>
          </g>
        ))}
        {actors.map((actor) => (
          <g key={actor.id} className="sl-actor" data-role={actor.role} data-lit={lit.length === 0 ? undefined : litSet.has(actor.id)}>
            <rect x={actor.x} y={actor.y} width={actor.w} height={actor.h} rx={10} />
            <text className="sl-name" x={actor.x + actor.w / 2} y={actor.y + actor.h / 2 - 5} textAnchor="middle">
              {actor.name}
            </text>
            <text className="sl-sub" x={actor.x + actor.w / 2} y={actor.y + actor.h / 2 + 12} textAnchor="middle">
              {marks[actor.id] ?? actor.sub}
            </text>
          </g>
        ))}
        {flows
          .filter((flow) => shownSet.has(flow.id))
          .map((flow) => {
            const last = flow.points.length - 1;
            const [lx, ly] = flowLabelAt(flow);
            return (
              <g key={flow.id} className="sl-flow">
                <path d={roundedPath(flow.points)} />
                <polygon points={arrowHead(flow.points[last - 1]!, flow.points[last]!)} />
                {flow.label === undefined ? null : (
                  <text x={lx} y={ly} textAnchor="middle">
                    {flow.label}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}

export interface CodeExcerpt {
  file: string;
  start: number;
  lines: readonly string[];
  /** 高亮的行段，行号按源文件算 */
  highlight?: readonly [number, number];
}

/** 这一步对应的源码：标题栏写文件与行号 */
export function CodeBlock({ code, role = 'slate' }: { code: CodeExcerpt; role?: Role }): JSX.Element {
  const end = code.start + code.lines.length - 1;
  return (
    <Pane title={code.file} role={role} icon="file" extra={`第 ${code.start}–${end} 行`}>
      <CodeLines lines={code.lines} start={code.start} highlight={code.highlight ?? null} tone="info" />
    </Pane>
  );
}
