'use client';
/**
 * 接缝图。不带属性画全局图：三个插件之间、插件与内核和基础插件之间的接缝（首页用）。
 * 带 module 属性画那个包内部的接缝图：包里的文件、文件之间的接缝、包外谁调用它、它要谁实现（包首页用）。
 * 每张图的内容在 *.data.mjs，坐标与图标在 *.layout.ts；机读版由 seam-map.ai.mjs 读同一份内容生成。
 */
import { SeamDiagram } from './seam-diagram';
import type { SeamLayout } from './seam-diagram';
import type { SeamGraph } from './seam-graph';
import './seam-map.css';
import { systemGraph } from './system.data.mjs';
import { systemLayout } from './system.layout';
import { shellGraph } from './inner/shell.data.mjs';
import { shellLayout } from './inner/shell.layout';
import { themeGraph } from './inner/theme.data.mjs';
import { themeLayout } from './inner/theme.layout';
import { baseuiGraph } from './inner/baseui.data.mjs';
import { baseuiLayout } from './inner/baseui.layout';

const INNER: Record<string, { graph: SeamGraph; layout: SeamLayout }> = {
  shell: { graph: shellGraph, layout: shellLayout },
  theme: { graph: themeGraph, layout: themeLayout },
  baseui: { graph: baseuiGraph, layout: baseuiLayout },
};

export function SeamMap({ module: moduleId }: { module?: string }) {
  if (moduleId === undefined) return <SeamDiagram graph={systemGraph} layout={systemLayout} />;
  const inner = INNER[moduleId];
  if (inner === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return <SeamDiagram graph={inner.graph} layout={inner.layout} />;
}
