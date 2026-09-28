/**
 * ReactBoot 在机读版里变成什么：跟画面读同一份数据（react-boot.data.mjs），每一步一段说明，
 * 再写明这一步在哪运行、照抄的源码，以及这一刻的登记表、importmap、<head> 里的样式与 #root。不 import React。
 */
import { stepsText } from '@godcreator/docfirst-explainer/text';
import { lanes, steps } from './react-boot.data.mjs';

const pairs = (list) => (list.length === 0 ? '空' : list.map(([name, url]) => `${name} → ${url}`).join('；'));
/** 逐行列出，每行前面带行号与「│」：行首不会被当成 markdown 结构 */
const numbered = (lines) => lines.map((line, i) => `${i + 1}│${line}`).join('\n');

export function ReactBoot(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.flatMap((step, i) => {
    const lane = lanes.find((l) => l.id === step.lane);
    return [
      paragraph(`${texts[i]}（在${lane.label}：${lane.detail}）`),
      ...(step.code === undefined ? [] : [paragraph(`${step.code.file}：`), paragraph(numbered(step.code.lines))]),
      paragraph(
        `此刻：内核登记表 ${pairs(step.registry)}。页面 importmap ${pairs(step.importmap)}。` +
          `<head> 里的样式 ${step.styles.length === 0 ? '无' : step.styles.join('、')}。#root：${step.root}。`,
      ),
    ];
  });
}
