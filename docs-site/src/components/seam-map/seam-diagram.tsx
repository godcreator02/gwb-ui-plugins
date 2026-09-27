'use client';
/**
 * 本文件与 seam-graph.ts、seam-map.css 是 @godcreator/explainer-player 提交 cf55862 里 SeamDiagram 的副本：那一版还没发布，
 * 发布后删掉这三份，改从包的主入口与 ./seam-graph 取，数据文件与布局表的形状不变。
 *
 * 接缝图的画法：虚线框是模块，框里的方块是能力，跨框的带编号连线是接缝，
 * 实线是代码调用、虚线是读写磁盘上的文件；框外的东西画成实线细框，入口是图外进来的灰色箭头。
 * 两件事互相独立：鼠标停在编号或模块框上（或键盘聚焦到它）浮出说明，挪开就收起；
 * 点击（或回车、空格）固定高亮关系——点编号高亮这条接缝和两端的能力，点模块框高亮跟它有关的接缝，再点一次取消。
 * 内容来自 defineSeamGraph 定义的图，坐标与图标来自站给的布局表。
 */
import { useState } from "react";
import type { ComponentType, CSSProperties, JSX, KeyboardEvent, ReactNode, SVGProps } from "react";
import { Pill } from "@godcreator/explainer-player";
import type { Seam, SeamGraph, SeamModule } from "./seam-graph";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 模块框与入口块里的图标：任意一个收 SVG 属性的组件，包不 import 图标库 */
export type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/** 一张图的坐标与图标。键都是图里的 id，缺一个画到它时报错 */
export interface SeamLayout {
  /** 画布的坐标范围，浮层位置按它换算成百分比 */
  view: { w: number; h: number };
  caps: Record<string, Box>;
  /** 模块外框；只有一个能力、名字也相同的框外模块写 null，不画外框 */
  groups: Record<string, Box | null>;
  /** 接缝走线与编号圆点 */
  seamPaths: Record<string, { d: string; badge: [number, number] }>;
  /** 入口方块与箭头（起点、终点） */
  entries: Record<string, { box: Box; arrow: [number, number, number, number] }>;
  moduleIcons: Record<string, Icon>;
  entryIcons: Record<string, Icon>;
}

const CAP_H = 48;

/** 能力方块的位置：高度固定，只给左上角与宽度 */
export const cap = (x: number, y: number, w: number): Box => ({ x, y, w, h: CAP_H });

function layoutOf<T>(table: Record<string, T>, id: string, what: string): T {
  if (!(id in table)) throw new Error(`接缝图的布局表里没有${what}「${id}」：图的数据加了东西，布局表要跟着加`);
  return table[id]!;
}

/** 浮层指着的东西：一条接缝或一个模块 */
interface Target {
  kind: "seam" | "module";
  id: string;
}

/** point 管浮层（停着就显示），pin 管高亮（点一下固定、再点取消） */
interface Pointing {
  point: (target: Target | null) => void;
  pin: (target: Target) => void;
}

const sameTarget = (p: Target | null, q: Target): boolean => p !== null && p.kind === q.kind && p.id === q.id;

function pointable(label: string, target: Target, pinned: boolean, { point, pin }: Pointing) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": pinned,
    onMouseEnter: () => point(target),
    onMouseLeave: () => point(null),
    onFocus: () => point(target),
    onBlur: () => point(null),
    onClick: () => pin(target),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      pin(target);
    },
  };
}

/** lit 为 undefined 表示什么都没固定：不高亮也不淡化 */
function CapBlock({ graph, layout, id, lit }: { graph: SeamGraph; layout: SeamLayout; id: string; lit: boolean | undefined }) {
  const box = layoutOf(layout.caps, id, "能力");
  const capability = graph.capById.get(id)!;
  const cx = box.x + box.w / 2;
  return (
    <g className="sm-cap" data-lit={lit}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} />
      <text className="sm-cap-name" x={cx} y={box.y + 20} textAnchor="middle">
        {capability.name}
      </text>
      <text className="sm-cap-ident" x={cx} y={box.y + 37} textAnchor="middle">
        {capability.ident}
      </text>
    </g>
  );
}

function ModuleGroup({
  graph,
  layout,
  module,
  focused,
  litCaps,
  pointing,
}: {
  graph: SeamGraph;
  layout: SeamLayout;
  module: SeamModule;
  focused: boolean;
  litCaps: Set<string> | null;
  pointing: Pointing;
}) {
  const frame = layoutOf(layout.groups, module.id, "模块");
  const FrameIcon = layoutOf(layout.moduleIcons, module.id, "模块图标");
  return (
    <g
      className="sm-module"
      data-role={module.role ?? "slate"}
      data-outside={module.outside}
      data-focus={focused}
      {...pointable(`模块 ${module.name}`, { kind: "module", id: module.id }, focused, pointing)}
    >
      {frame === null ? null : (
        <>
          <rect className="sm-frame" x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={12} />
          <FrameIcon className="sm-icon" x={frame.x + 10} y={frame.y + 7} width={14} height={14} strokeWidth={2} />
          <text x={frame.x + 30} y={frame.y + 18}>
            <tspan className="sm-frame-name">{module.name}</tspan>
            <tspan className="sm-frame-pkg" dx={8}>
              {module.pkg}
            </tspan>
          </text>
        </>
      )}
      {module.caps.map((c) => (
        <CapBlock key={c.id} graph={graph} layout={layout} id={c.id} lit={litCaps === null ? undefined : litCaps.has(c.id)} />
      ))}
    </g>
  );
}

/** on 为 undefined 表示什么都没固定：不高亮也不淡化 */
function SeamLine({ layout, seam, on, pinned, pointing }: { layout: SeamLayout; seam: Seam; on: boolean | undefined; pinned: boolean; pointing: Pointing }) {
  const { d, badge } = layoutOf(layout.seamPaths, seam.id, "接缝");
  const [bx, by] = badge;
  return (
    <g className="sm-seam" data-on={on} data-via={seam.via}>
      <path d={d} />
      <g className="sm-badge" {...pointable(`接缝 ${seam.label}`, { kind: "seam", id: seam.id }, pinned, pointing)}>
        <circle className="sm-badge-hit" cx={bx} cy={by} r={13} />
        <circle className="sm-badge-ring" cx={bx} cy={by} r={9.5} />
        <text x={bx} y={by} textAnchor="middle" dominantBaseline="central">
          {seam.n}
        </text>
      </g>
    </g>
  );
}

function EntryArrow({ layout, id, name }: { layout: SeamLayout; id: string; name: string }) {
  const { box, arrow } = layoutOf(layout.entries, id, "入口");
  const [x1, y1, x2, y2] = arrow;
  const head = y1 === y2 ? `${x2},${y2} ${x2 - 7},${y2 - 4} ${x2 - 7},${y2 + 4}` : `${x2},${y2} ${x2 - 4},${y2 - 7} ${x2 + 4},${y2 - 7}`;
  const EntryIcon = layoutOf(layout.entryIcons, id, "入口图标");
  const cx = box.x + box.w / 2;
  // 高的入口块图标在上、字在下；矮的一行块图标在字左边
  const tall = box.h >= 40;
  return (
    <g className="sm-entry">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={tall ? 14 : box.h / 2} />
      {tall ? (
        <>
          <EntryIcon className="sm-icon" x={cx - 8} y={box.y + 7} width={16} height={16} strokeWidth={1.8} />
          <text x={cx} y={box.y + 35} textAnchor="middle" dominantBaseline="central">
            {name}
          </text>
        </>
      ) : (
        <>
          <EntryIcon className="sm-icon" x={box.x + 12} y={box.y + box.h / 2 - 7} width={14} height={14} strokeWidth={1.8} />
          <text x={cx + 9} y={box.y + box.h / 2} textAnchor="middle" dominantBaseline="central">
            {name}
          </text>
        </>
      )}
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={head} />
    </g>
  );
}

/** 图例：每种元素的意思，末尾一句怎么看说明 */
function Legend({ graph }: { graph: SeamGraph }) {
  const item = (mark: ReactNode, text: string) => (
    <span className="sm-legend-item">
      <svg width="26" height="14" aria-hidden="true">
        {mark}
      </svg>
      {text}
    </span>
  );
  return (
    <div className="sm-legend">
      {item(<rect x="1" y="1" width="24" height="12" rx="3" className="sm-lg-frame" />, graph.frameLabel)}
      {item(<rect x="3" y="2" width="20" height="10" rx="2" className="sm-lg-cap" />, "能力")}
      {item(<line x1="1" y1="7" x2="25" y2="7" className="sm-lg-code" />, "代码调用")}
      {item(<line x1="1" y1="7" x2="25" y2="7" className="sm-lg-disk" />, "读写磁盘上的文件")}
      {item(
        <>
          <circle cx="13" cy="7" r="6" className="sm-lg-badge" />
          <text x="13" y="7" textAnchor="middle" dominantBaseline="central" className="sm-lg-badge-n">
            n
          </text>
        </>,
        "接缝编号",
      )}
      {graph.entries.length === 0
        ? null
        : item(<rect x="2" y="2" width="22" height="10" rx="5" className="sm-lg-entry" />, "从外面进来的入口")}
      <span className="sm-legend-hint">鼠标停在编号或模块框上看说明，点击固定高亮它连着谁</span>
    </div>
  );
}

function ModuleIcon({ layout, moduleId }: { layout: SeamLayout; moduleId: string }) {
  const Glyph = layoutOf(layout.moduleIcons, moduleId, "模块图标");
  return <Glyph className="sm-inline-icon" width={13} height={13} strokeWidth={2} aria-hidden="true" />;
}

function SeamTip({ graph, layout, seam }: { graph: SeamGraph; layout: SeamLayout; seam: Seam }) {
  const end = (ids: string[]) =>
    ids.map((id) => {
      const owner = graph.moduleOfCap.get(id)!;
      return (
        <Pill key={id} role={owner.role ?? "slate"}>
          <ModuleIcon layout={layout} moduleId={owner.id} />
          {graph.capById.get(id)!.name}
        </Pill>
      );
    });
  return (
    <>
      <div className="sm-tip-head">
        <b>{seam.label}</b>
        <Pill tone={seam.convention ? "warn" : "info"}>{seam.convention ? "约定，没有代码接口" : "代码接口"}</Pill>
      </div>
      <div className="sm-ends">
        {end(seam.a)}
        <span className="sm-arrow" aria-hidden="true">
          ↔
        </span>
        {end(seam.b)}
      </div>
      <p className="sm-tip-text">{seam.text}</p>
      <code className="sm-iface">{seam.iface}</code>
    </>
  );
}

function ModuleTip({ graph, layout, module }: { graph: SeamGraph; layout: SeamLayout; module: SeamModule }) {
  const related = graph.seamsOfModule(module.id);
  return (
    <>
      <div className="sm-tip-head" data-role={module.role ?? "slate"}>
        <b className="sm-module-name">
          <ModuleIcon layout={layout} moduleId={module.id} />
          {module.name}
        </b>
        <code className="sm-module-pkg">{module.pkg}</code>
      </div>
      <p className="sm-tip-text">{module.blurb}</p>
      {related.length === 0 ? null : <p className="sm-related">相关接缝：{related.map((s) => s.label).join(" · ")}</p>}
    </>
  );
}

/** 浮层放在哪儿：横向位置，以及上下两条边（浮层放在下边之下或上边之上） */
function anchorOf(graph: SeamGraph, layout: SeamLayout, target: Target): { x: number; top: number; bottom: number } {
  if (target.kind === "seam") {
    const [bx, by] = layoutOf(layout.seamPaths, target.id, "接缝").badge;
    return { x: bx, top: by - 12, bottom: by + 12 };
  }
  const module = graph.modules.find((m) => m.id === target.id)!;
  const box = layoutOf(layout.groups, module.id, "模块") ?? layoutOf(layout.caps, module.caps[0]!.id, "能力");
  return { x: box.x + box.w / 2, top: box.y, bottom: box.y + box.h };
}

/**
 * 浮层：上半张图的东西，浮层放在它下面；下半张的放在上面。横向按锚点在图里的比例平移，
 * 锚点在最左时浮层左边对齐、在最右时右边对齐，所以不会伸出图外。
 */
function Tip({ graph, layout, target }: { graph: SeamGraph; layout: SeamLayout; target: Target }) {
  const { x, top, bottom } = anchorOf(graph, layout, target);
  const below = (top + bottom) / 2 < layout.view.h / 2;
  const across = (x / layout.view.w) * 100;
  const style: CSSProperties = {
    left: `${across}%`,
    top: `${((below ? bottom : top) / layout.view.h) * 100}%`,
    transform: `translate(${-across}%, ${below ? "8px" : "calc(-100% - 8px)"})`,
  };
  const content =
    target.kind === "seam" ? (
      <SeamTip graph={graph} layout={layout} seam={graph.seams.find((s) => s.id === target.id)!} />
    ) : (
      <ModuleTip graph={graph} layout={layout} module={graph.modules.find((m) => m.id === target.id)!} />
    );
  return (
    <div className="sm-tip" style={style} role="tooltip">
      {content}
    </div>
  );
}

export interface SeamDiagramProps {
  graph: SeamGraph;
  layout: SeamLayout;
}

export function SeamDiagram({ graph, layout }: SeamDiagramProps): JSX.Element {
  /** 浮层显示的是鼠标停着的那个；高亮的是点击固定的那个，两者互不影响 */
  const [shown, setShown] = useState<Target | null>(null);
  const [pinned, setPinned] = useState<Target | null>(null);
  const pointing: Pointing = {
    point: setShown,
    pin: (target) => setPinned((current) => (sameTarget(current, target) ? null : target)),
  };

  const focused = pinned?.kind === "module" ? graph.modules.find((m) => m.id === pinned.id)! : null;
  const seam = pinned?.kind === "seam" ? graph.seams.find((s) => s.id === pinned.id)! : null;
  const active = focused !== null ? graph.seamsOfModule(focused.id) : seam !== null ? [seam] : [];
  const nothingPinned = pinned === null;
  const activeIds = new Set(active.map((s) => s.id));
  const litCaps = nothingPinned ? null : new Set(active.flatMap((s) => [...s.a, ...s.b]));
  if (focused !== null && litCaps !== null) for (const c of focused.caps) litCaps.add(c.id);
  // 高亮的接缝画在最后，压在别的线上面
  const drawOrder = [...graph.seams].sort((p, q) => Number(activeIds.has(p.id)) - Number(activeIds.has(q.id)));

  return (
    <div className="dx seam-map not-prose">
      <Legend graph={graph} />
      <div className="sm-scroll">
        <div className="sm-canvas">
          <svg className="sm-svg" viewBox={`0 0 ${layout.view.w} ${layout.view.h}`} role="group" aria-label={graph.title}>
            {graph.entries.map((e) => (
              <EntryArrow key={e.id} layout={layout} id={e.id} name={e.name} />
            ))}
            {graph.modules.map((m) => (
              <ModuleGroup key={m.id} graph={graph} layout={layout} module={m} focused={focused?.id === m.id} litCaps={litCaps} pointing={pointing} />
            ))}
            {drawOrder.map((s) => (
              <SeamLine key={s.id} layout={layout} seam={s} on={nothingPinned ? undefined : activeIds.has(s.id)} pinned={seam?.id === s.id} pointing={pointing} />
            ))}
          </svg>
          {shown === null ? null : <Tip graph={graph} layout={layout} target={shown} />}
        </div>
      </div>
    </div>
  );
}
