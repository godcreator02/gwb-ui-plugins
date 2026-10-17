/**
 * DesktopSwitchSteps 在机读版里变成什么：跟画面读同一份数据（desktop-switch.data.mjs），先一段写例子，
 * 再每一步一段话，后面跟这一步留下的记录。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { stepsText } from '@godcreator/explainer';
import { desks, steps } from './desktop-switch.data.mjs';

export function DesktopSwitchSteps(_node, { paragraph }) {
  const texts = stepsText(steps);
  return [
    paragraph(`例子：从 ${desks.map((d) => `${d.name}（${d.id}，开着 ${d.panes.join('、')}）`).join('切到')}。`),
    ...steps.map((step, i) =>
      paragraph(step.log.length === 0 ? texts[i] : `${texts[i]} 记录：${step.log.map((line) => line.text).join('；')}`),
    ),
  ];
}
