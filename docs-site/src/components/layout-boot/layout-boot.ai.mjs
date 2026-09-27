/**
 * LayoutBootCases 在机读版里变成什么：跟画面读同一份数据（layout-boot.data.mjs），每种情况一段：
 * 说明，再按四个环节写它得到什么，最后是状态栏。这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/explainer-player/text';
import { cases, stages } from './layout-boot.data.mjs';

export function LayoutBootCases(_node, { paragraph }) {
  const texts = casesText(cases);
  return cases.map((item, i) =>
    paragraph(
      `${texts[i]} ${stages.map((stage) => `${stage.title}：${item[stage.id]}`).join('；')}；状态栏：${item.bar}。`,
    ),
  );
}
