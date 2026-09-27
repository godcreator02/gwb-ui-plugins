/**
 * SubsetSheets 在机读版里变成什么：跟画面读同一份数据（subset-sheets.data.mjs），每一步一段说明，
 * 再把那一步页面上 @layer utilities 里的规则按加载先后列出来、写明元素最终的左右内边距。不 import React。
 */
import { stepsText } from '@godcreator/explainer-player/text';
import { sheets, steps } from './subset-sheets.data.mjs';

function stateOf(step) {
  if (step.compiled !== undefined) {
    const lists = Object.entries(step.compiled).map(
      ([sheet, rules]) => `${sheets[sheet].file}：${rules.map((r) => `${r.selector} { ${r.decl} }`).join('；')}`,
    );
    return `元素 class="${step.classAttr}"。还没进页面的两张表——${lists.join('。')}。`;
  }
  const rows = step.layer.map(
    (r, i) => `${i + 1}. ${r.sheet} 的 ${r.selector} { ${r.decl} }（${r.key === step.winner ? '决定左右内边距' : r.matches ? '命中' : '不命中'}）`,
  );
  return `元素 class="${step.classAttr}"。页面上的 @layer utilities：${rows.join('；')}。左右内边距 ${step.paddingInline}rem，${step.ok ? '跟写的一样' : '被覆盖，没有报错'}。`;
}

export function SubsetSheets(_node, { paragraph }) {
  const texts = stepsText(steps);
  return steps.flatMap((step, i) => [paragraph(texts[i]), paragraph(stateOf(step))]);
}
