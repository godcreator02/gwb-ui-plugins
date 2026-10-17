/**
 * AppearanceFlow 在机读版里变成什么：跟画面读同一份数据（appearance-flow.data.mjs），每一步一段话，
 * 再列出启动时页面 <head> 里的样式元素顺序与例子里拼出来的启动样式。这个文件不 import React。
 */
import { stepsText } from '@godcreator/explainer';
import { headElements, steps } from './appearance-flow.data.mjs';

/** 逐行列出，每行前面带行号与「│」：行首不会是会被当成 markdown 结构的字符 */
const numbered = (lines) => lines.map((line, i) => `${i + 1}│${line}`).join('\n');

export function AppearanceFlow(_node, { paragraph }) {
  const injected = steps.find((step) => step.id === 'inject');
  const order = injected.head
    .map((item, i) => {
      const element = headElements[item.key];
      return `${i + 1}. ${element.tag} ${element.name}（${element.layered ? '在 @layer 里' : '不分层'}）：${element.note}`;
    })
    .join('；');
  return [
    ...stepsText(steps).map((text) => paragraph(text)),
    paragraph(`启动后页面 <head> 里与外观有关的元素，按文档顺序：${order}。外观窗格打开后，它自己的样式表追加在最后（在 @layer 里）。`),
    paragraph('例子里 home 存着等宽字体 Consolas, monospace 与一段自定义 CSS，拼出来的启动样式：'),
    paragraph(numbered(injected.css)),
  ];
}
