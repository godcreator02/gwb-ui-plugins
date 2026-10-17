/**
 * SeamMap 在机读版里变成什么：跟画面读同一份内容，先一段图的说明与入口，再每个模块一段，最后每条接缝一段。
 * 带 module 属性时写的是那个包的内部图。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { seamGraphText } from '@godcreator/explainer';
import { systemGraph } from './system.data.mjs';
import { shellGraph } from './inner/shell.data.mjs';
import { themeGraph } from './inner/theme.data.mjs';
import { baseuiGraph } from './inner/baseui.data.mjs';

const INNER = { shell: shellGraph, theme: themeGraph, baseui: baseuiGraph };

export function SeamMap(node, { paragraph, attr }) {
  const moduleId = attr(node, 'module');
  const graph = moduleId === undefined ? systemGraph : INNER[moduleId];
  if (graph === undefined) throw new Error(`SeamMap 没有「${moduleId}」的内部图，有的是：${Object.keys(INNER).join('、')}`);
  return seamGraphText(graph).map((text) => paragraph(text));
}
