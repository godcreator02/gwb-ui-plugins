'use client';
/**
 * 「一个颜色令牌在构建时与运行时各经过哪几处」：每一步画出这一步涉及的文件，高亮起作用的那几行；
 * 运行时的两步另画一块色块，颜色就是 --primary 在那一刻解析出的值。
 * 讲解文字与代码行都在 token-flow.data.mjs，机读版由 token-flow.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill, Stepper } from '@godcreator/explainer-player';
import type { Role } from '@godcreator/explainer-player';
import { steps } from './token-flow.data.mjs';
import './token-flow.css';

type TokenStep = (typeof steps)[number];

function Swatch({ swatch }: { swatch: NonNullable<TokenStep['swatch']> }): JSX.Element {
  return (
    <div className="tf-swatch">
      <span className="tf-chip" style={{ background: swatch.value }} />
      <span>
        <code>var(--primary)</code> → <code>{swatch.value}</code>
        <span className="tf-from">（取自 {swatch.dark ? '.dark' : ':root'}）</span>
      </span>
    </div>
  );
}

function Scene({ step }: { step: TokenStep }): JSX.Element {
  return (
    <div className="tf-scene">
      <div>
        <Pill role={step.when === '构建时' ? 'amber' : 'violet'}>{step.when}</Pill>
      </div>
      <div className="tf-cards" data-count={step.cards.length}>
        {step.cards.map((card) => (
          <Pane key={card.file} title={card.file} role={card.role as Role} icon="file" extra={card.note}>
            <CodeLines lines={card.lines} highlight={card.highlight ?? null} tone={card.role === 'rose' ? 'bad' : 'info'} />
          </Pane>
        ))}
      </div>
      {step.swatch !== undefined ? <Swatch swatch={step.swatch} /> : null}
    </div>
  );
}

export function TokenFlow(): JSX.Element {
  return (
    <Stepper steps={steps} label="一个颜色令牌在构建时与运行时各经过哪几处" interval={5600}>
      {(step) => <Scene step={step} />}
    </Stepper>
  );
}
