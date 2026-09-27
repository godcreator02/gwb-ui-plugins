'use client';
/**
 * 「两张子集表叠进同一层，后加载的那条把先加载的覆盖」：左边是 baseui 窗格里的一个元素和它最终的左右内边距，
 * 右边是页面上 @layer utilities 里的规则、按加载先后排列。讲解文字与规则都在 subset-sheets.data.mjs，机读版由 subset-sheets.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { Pane, Pill, Stepper } from '@godcreator/explainer-player';
import type { Role } from '@godcreator/explainer-player';
import { sheets, steps } from './subset-sheets.data.mjs';
import './subset-sheets.css';

type SheetStep = (typeof steps)[number];
type SheetName = keyof typeof sheets;

/** 1rem 画成多少像素 */
const REM_PX = 22;

function roleOf(sheet: SheetName): Role {
  return sheets[sheet].role as Role;
}

function Element({ step }: { step: SheetStep }): JSX.Element {
  const inline = step.paddingInline;
  return (
    <Pane title="baseui 窗格里的一个元素" role="blue">
      <code className="ss-tag">{`<div class="${step.classAttr}">`}</code>
      {inline === undefined ? (
        <p className="ss-note">这两张表还没进页面，元素也还没有样式。</p>
      ) : (
        <>
          <div className="ss-box" data-ok={step.ok}>
            <span className="ss-pad" style={{ width: inline * REM_PX }} />
            <span className="ss-content">内容</span>
            <span className="ss-pad" style={{ width: inline * REM_PX }} />
          </div>
          <div className="ss-verdict">
            <span>左右内边距 {inline}rem</span>
            {step.ok ? <Pill tone="good" dot>跟写的一样</Pill> : <Pill tone="bad" dot>被覆盖了，没有报错</Pill>}
          </div>
        </>
      )}
    </Pane>
  );
}

function Rule({ selector, decl }: { selector: string; decl: string }): JSX.Element {
  return (
    <code className="ss-rule">
      {selector} {'{'} {decl} {'}'}
    </code>
  );
}

function Compiled({ step }: { step: SheetStep }): JSX.Element {
  const compiled = step.compiled!;
  return (
    <div className="ss-compiled">
      {(Object.keys(compiled) as SheetName[]).map((sheet) => (
        <Pane key={sheet} title={sheets[sheet].file} role={roleOf(sheet)} icon="file" extra="编译产物">
          {compiled[sheet].map((rule) => (
            <Rule key={rule.selector} selector={rule.selector} decl={rule.decl} />
          ))}
        </Pane>
      ))}
    </div>
  );
}

function Layer({ step }: { step: SheetStep }): JSX.Element {
  return (
    <Pane title="页面上的 @layer utilities（按加载先后）" role="slate">
      <ol className="ss-layer">
        {step.layer.map((rule, index) => (
          <li
            key={rule.key}
            className="ss-row"
            data-role={roleOf(rule.sheet)}
            data-matches={rule.matches}
            data-winner={rule.key === step.winner}
          >
            <span className="ss-order">{index + 1}</span>
            <Pill role={roleOf(rule.sheet)}>{rule.sheet}</Pill>
            <Rule selector={rule.selector} decl={rule.decl} />
            <span className="ss-hit">
              {rule.key === step.winner ? '决定左右内边距' : rule.matches ? '命中这个元素' : '不命中'}
            </span>
          </li>
        ))}
      </ol>
    </Pane>
  );
}

function Scene({ step }: { step: SheetStep }): JSX.Element {
  return (
    <div className="ss-scene">
      <Element step={step} />
      {step.compiled !== undefined ? <Compiled step={step} /> : <Layer step={step} />}
    </div>
  );
}

export function SubsetSheets(): JSX.Element {
  return (
    <Stepper steps={steps} label="两张子集表叠进同一层" interval={5200}>
      {(step) => <Scene step={step} />}
    </Stepper>
  );
}
