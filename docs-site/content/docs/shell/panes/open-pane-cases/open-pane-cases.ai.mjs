/**
 * OpenPaneCases 在机读版里变成什么：跟画面读同一份数据（open-pane-cases.data.mjs）。
 * 先两段写规则（目标组的几条、查重的几条），再每种情况一段：调用、打开前后两张桌面、走到的规则与 planOpen 回的判断。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能运行。
 */
import { casesText } from '@godcreator/explainer';
import { autoRules, cases, checks, panes, sideRule } from './open-pane-cases.data.mjs';

const tabText = (tab) =>
  `${panes[tab.pane].label}${tab.key === undefined ? '' : `·${tab.key}`}${tab.preview ? '（预览）' : ''}${tab.active ? '（活动）' : ''}${tab.source ? '（来源）' : ''}`;

const deskText = (desk) => {
  const groups = desk.groups.length === 0 ? '空桌面' : desk.groups.map((g) => `${g.id}：${g.tabs.map(tabText).join('、')}`).join('；');
  const other = desk.other === undefined ? '' : `；${desk.other.name}：${desk.other.tabs.map(tabText).join('、')}`;
  return `${groups}${other}`;
};

const ruleText = (id) => {
  if (id === 'side') return `${sideRule.when} → ${sideRule.then}`;
  const rule = autoRules.find((r) => r.id === id);
  return `第 ${rule.id} 条：${rule.when} → ${rule.then}`;
};

export function OpenPaneCases(_node, { paragraph }) {
  const texts = casesText(cases);
  return [
    paragraph(
      `目标组（targetGroup），placement 缺省时按顺序取第一个成立的：${autoRules.map((r) => `${r.id}. ${r.when} → ${r.then}`).join('；')}。${sideRule.when} 时：${sideRule.then}。`,
    ),
    paragraph(
      `查重与结论（planOpen），按顺序：${checks.map((c) => `${c.kinds.length === 2 ? '两类' : c.kinds[0] === 'tool' ? '工具窗格' : '文档窗格'}——${c.text}`).join('；')}。`,
    ),
    ...cases.map((item, i) =>
      paragraph(
        `${texts[i]} 调用：${item.call}。打开之前：${deskText(item.before)}。打开之后：${deskText(item.after)}${item.after.notice === undefined ? '' : `，状态栏：${item.after.notice}`}。` +
          `目标组走到${ruleText(item.rule)}；查重走到「${checks.find((c) => c.id === item.check).text}」；planOpen 回 ${item.plan}。`,
      ),
    ),
  ];
}
