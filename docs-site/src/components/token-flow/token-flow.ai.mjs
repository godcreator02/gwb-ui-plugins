/**
 * TokenFlow 在机读版里变成什么：跟画面读同一份数据（token-flow.data.mjs），每一步一段说明，
 * 再把这一步画出的文件逐个列出代码行，运行时的两步写明 --primary 解析出的值。不 import React。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import { steps } from './token-flow.data.mjs';

/** 逐行列出，每行前面带行号与「│」：行首不会是 <、# 这类会被当成 markdown 或 HTML 结构的字符 */
const numbered = (lines) => lines.map((line, i) => `${i + 1}│${line}`).join('\n');

export function TokenFlow(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.flatMap((step, i) => [
    paragraph(`${texts[i]}（${step.when}）`),
    ...step.cards.flatMap((card) => [paragraph(`${card.file}${card.note ? `（${card.note}）` : ''}：`), paragraph(numbered(card.lines))]),
    ...(step.swatch === undefined
      ? []
      : [paragraph(`var(--primary) 解析为 ${step.swatch.value}，取自 ${step.swatch.dark ? '.dark' : ':root'}。`)]),
  ]);
}
