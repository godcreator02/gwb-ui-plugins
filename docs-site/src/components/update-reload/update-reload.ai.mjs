/**
 * UpdateReloadCases 在机读版里变成什么：跟画面读同一份数据（update-reload.data.mjs），先一段四步的顺序，
 * 再每种情况一段说明，后面跟着回执要点、窗格上显示的文字与每一步走没走到。这个文件不 import React。
 */
import { casesText } from '@godcreator/docfirst-explainer/text';
import { cases, stations } from './update-reload.data.mjs';

const STATE_TEXT = { pass: '走过', stop: '停在这里', skip: '没走到' };

export function UpdateReloadCases(_node, { paragraph }) {
  const explained = casesText(cases);
  return [
    paragraph(`插件管理窗格升级之后依次走四步：${stations.map((s, i) => `${i + 1}. ${s.name}（${s.ident}）`).join(' → ')}。`),
    ...cases.flatMap((item, i) => [
      paragraph(explained[i]),
      paragraph(
        `回执：${item.receipt.join('；')}。窗格显示：${item.shown.join(' / ')}。` +
          stations.map((s) => `${s.name}：${STATE_TEXT[item.states[s.id]]}${item.notes[s.id] ? `（${item.notes[s.id]}）` : ''}`).join('；') +
          `。${item.reloads ? '接着整页刷新' : '不刷新'}。`,
      ),
    ]),
  ];
}
