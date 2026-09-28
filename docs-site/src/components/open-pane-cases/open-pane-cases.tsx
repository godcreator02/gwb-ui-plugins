'use client';
/**
 * 「开一个窗格落在哪、做什么」：选一种情况，上面是这次调用，中间是打开之前与之后的桌面（组画成卡片，标签画在卡片顶上），
 * 下面两张卡是 targetGroup 走到了哪一条、planOpen 的查重走到了哪一条与它回的判断。内容全在 open-pane-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Pill } from '@godcreator/docfirst-explainer';
import { autoRules, cases, checks, panes, sideRule } from './open-pane-cases.data.mjs';
import './open-pane-cases.css';

type OpenCase = (typeof cases)[number];
type Desk = OpenCase['before'];
type Tab = Desk['groups'][number]['tabs'][number];

const RESULT_TEXT: Record<string, string> = { new: '新开', focus: '激活', retarget: '原地换内容', kept: '转成正式' };

function TabChip({ tab }: { tab: Tab }): JSX.Element {
  const pane = panes[tab.pane];
  return (
    <span
      className="op-tab"
      data-active={tab.active === true}
      data-source={tab.source === true}
      data-result={tab.result}
      title={pane.kind === 'tool' ? '工具窗格' : '文档窗格'}
    >
      {tab.preview === true ? <span className="op-preview" aria-label="预览窗格" /> : null}
      {pane.label}
      {tab.key === undefined ? null : <span className="op-key">·{tab.key}</span>}
      {tab.source === true ? <span className="op-badge op-badge-source">来源</span> : null}
      {tab.result === undefined ? null : <span className="op-badge">{RESULT_TEXT[tab.result]}</span>}
    </span>
  );
}

function DeskPicture({ desk, title }: { desk: Desk; title: string }): JSX.Element {
  return (
    <div className="op-desk-wrap">
      <div className="op-desk-title">{title}</div>
      <div className="op-desk-row">
        <div className="op-desk">
          {desk.groups.length === 0 ? <span className="op-empty">空桌面</span> : null}
          {desk.groups.map((group) => (
            <div
              key={group.id}
              className="op-group"
              data-target={group.target === true}
              data-born={group.born === true}
              style={{ left: `calc(${group.x}% + 4px)`, width: `calc(${group.w}% - 8px)` }}
            >
              <div className="op-tabs">
                {group.tabs.map((tab, i) => (
                  <TabChip key={`${tab.pane}-${tab.key ?? ''}-${i}`} tab={tab} />
                ))}
              </div>
              <span className="op-group-id">{group.id}</span>
            </div>
          ))}
        </div>
        {desk.other === undefined ? null : (
          <div className="op-other">
            <div className="op-other-name">{desk.other.name}</div>
            <div className="op-tabs">
              {desk.other.tabs.map((tab, i) => (
                <TabChip key={`${tab.pane}-${i}`} tab={tab} />
              ))}
            </div>
          </div>
        )}
      </div>
      {desk.notice === undefined ? null : <div className="op-notice">状态栏：{desk.notice}</div>}
    </div>
  );
}

type RowState = 'miss' | 'hit' | 'skip' | 'na';
const STATE_TEXT: Record<RowState, string> = { miss: '不成立', hit: '成立', skip: '没走到', na: '不适用' };

function Row({ state, label, text }: { state: RowState; label: string; text: string }): JSX.Element {
  return (
    <li className="op-row" data-state={state}>
      <span className="op-row-label">{label}</span>
      <span className="op-row-text">{text}</span>
      <span className="op-row-state">{STATE_TEXT[state]}</span>
    </li>
  );
}

function RuleLadder({ item }: { item: OpenCase }): JSX.Element {
  const hitIndex = autoRules.findIndex((rule) => rule.id === item.rule);
  const autoState = (i: number): RowState => (item.rule === 'side' ? 'na' : i < hitIndex ? 'miss' : i === hitIndex ? 'hit' : 'skip');
  return (
    <Pane title="目标组：targetGroup" role="blue">
      <ol className="op-rows">
        <Row state={item.rule === 'side' ? 'hit' : 'na'} label="side" text={`${sideRule.when} → ${sideRule.then}`} />
        {autoRules.map((rule, i) => (
          <Row key={rule.id} state={autoState(i)} label={rule.id} text={`${rule.when} → ${rule.then}`} />
        ))}
      </ol>
    </Pane>
  );
}

function CheckLadder({ item }: { item: OpenCase }): JSX.Element {
  const kind = item.pane;
  const hitIndex = checks.findIndex((check) => check.id === item.check);
  const state = (i: number): RowState => {
    if (!checks[i]!.kinds.includes(kind)) return 'na';
    return i < hitIndex ? 'miss' : i === hitIndex ? 'hit' : 'skip';
  };
  return (
    <Pane title={`查重与结论：planOpen（${kind === 'tool' ? '工具窗格' : '文档窗格'}）`} role="emerald">
      <ol className="op-rows">
        {checks.map((check, i) => (
          <Row key={check.id} state={state(i)} label={check.kinds.length === 2 ? '都' : check.kinds[0] === 'tool' ? '工具' : '文档'} text={check.text} />
        ))}
      </ol>
      <code className="op-plan">{item.plan}</code>
    </Pane>
  );
}

function Picture({ item }: { item: OpenCase }): JSX.Element {
  return (
    <>
      <div className="op-call">
        <Pill role="slate">调用</Pill>
        <code>{item.call}</code>
      </div>
      <div className="op-desks">
        <DeskPicture desk={item.before} title="打开之前" />
        <DeskPicture desk={item.after} title="打开之后" />
      </div>
      <div className="op-ladders">
        <RuleLadder item={item} />
        <CheckLadder item={item} />
      </div>
    </>
  );
}

export function OpenPaneCases(): JSX.Element {
  return (
    <div className="open-pane-cases not-prose">
      <CasePicker cases={cases} label="开一个窗格的几种情况">
        {(item) => <Picture item={item} />}
      </CasePicker>
    </div>
  );
}
