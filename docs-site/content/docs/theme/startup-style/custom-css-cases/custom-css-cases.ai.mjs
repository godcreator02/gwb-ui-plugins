/**
 * CustomCssCases 在机读版里变成什么：跟画面读同一份数据（custom-css-cases.data.mjs），先一段比较规则，
 * 再每种情况一段说明，后面跟着另一条规则、自定义 CSS 与三样各比出什么。这个文件不 import React。
 */
import { casesText } from '@godcreator/explainer';
import { cases, criteria } from './custom-css-cases.data.mjs';

const OUTCOME_TEXT = { mine: '自定义 CSS 赢', rival: '另一条规则赢', tie: '相同', skip: '不用比' };

export function CustomCssCases(_node, { paragraph }) {
  const explained = casesText(cases);
  return [
    paragraph(`两条规则抢同一个属性时依次比：${criteria.join(' → ')}，前一样分出胜负就不再往下比。自定义 CSS 在 #gwb-theme-style 里，不分层，排在外壳三张表之后。`),
    ...cases.flatMap((item, i) => [
      paragraph(explained[i]),
      paragraph(
        `另一条规则（${item.rivalSource}）：${item.rivalLines.join(' ')}　自定义 CSS：${item.mineLines.join(' ')}　` +
          item.comparisons.map((c, k) => `${criteria[k]}：另一条规则 ${c.rival}，自定义 CSS ${c.mine}，${OUTCOME_TEXT[c.outcome]}`).join('；') +
          `。结果：${item.winner === 'mine' ? '自定义 CSS 生效' : '自定义 CSS 被压住'}。`,
      ),
    ]),
  ];
}
