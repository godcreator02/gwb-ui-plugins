/**
 * NameIsolation 在机读版里变成什么：跟画面读同一份数据（name-isolation.data.mjs）。
 * 先列出两种写法下的简化 DOM 树，再每种情况一段说明，加上那条规则命中、漏掉、错命中的节点。不 import React。
 */
import { casesText } from '@godcreator/explainer-player/text';
import { cases, nodes } from './name-isolation.data.mjs';

const describe = (id, mode) => {
  const node = nodes.find((n) => n.id === id);
  return `${mode === 'bare' ? node.bare : node.prefixed}（${node.note}）`;
};

/** 每行前面带「│」再按深度缩进：行首不会是 <，不被当成 HTML */
const tree = (mode) =>
  nodes.map((n) => `│${'  '.repeat(n.depth)}${mode === 'bare' ? n.bare : n.prefixed}${n.note ? `  ← ${n.note}` : ''}`).join('\n');

export function NameIsolation(_node, { paragraph }) {
  const texts = casesText(cases);
  return [
    paragraph('按位置隔离时（类名不带前缀）页面的 DOM，简化后：'),
    paragraph(tree('bare')),
    paragraph('按名字隔离时（类名带插件前缀）同一棵树：'),
    paragraph(tree('prefixed')),
    ...cases.flatMap((c, i) => {
      const list = (ids) => (ids.length === 0 ? '无' : ids.map((id) => describe(id, c.mode)).join('；'));
      return [
        paragraph(texts[i]),
        paragraph(`规则 ${c.selector}。命中：${list(c.matched)}。该命中没命中：${list(c.missed)}。不该命中却命中：${list(c.leaked)}。`),
      ];
    }),
  ];
}
