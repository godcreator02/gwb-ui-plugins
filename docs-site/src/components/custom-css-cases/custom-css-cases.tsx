'use client';
/**
 * 「自定义 CSS 跟谁比」：选一种情况，左边是跟它抢同一个属性的另一条规则（slate）、右边是 #gwb-theme-style 里的那条（emerald），
 * 下面三格依次比在不在 @layer 里、特异性、文档顺序，分出胜负的那一格着色，后面的变淡。讲解文字与数据都在 custom-css-cases.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/docfirst-explainer';
import type { Tone } from '@godcreator/docfirst-explainer';
import { cases, criteria } from './custom-css-cases.data.mjs';

type CssCase = (typeof cases)[number];
type Comparison = CssCase['comparisons'][number];

const OUTCOME: Record<Comparison['outcome'], { tone?: Tone; text: string }> = {
  mine: { tone: 'good', text: '自定义 CSS 赢' },
  rival: { tone: 'bad', text: '另一条规则赢' },
  tie: { text: '相同，比下一样' },
  skip: { text: '不用比' },
};

function Criterion({ index, comparison }: { index: number; comparison: Comparison }): JSX.Element {
  const outcome = OUTCOME[comparison.outcome];
  const decided = comparison.outcome === 'mine' || comparison.outcome === 'rival';
  return (
    <div
      data-tone={outcome.tone}
      className="grid content-start gap-1 rounded-xl border p-2 text-xs"
      style={{
        borderColor: decided ? 'color-mix(in srgb, var(--dx-c) 45%, transparent)' : 'var(--dx-line)',
        background: decided ? 'color-mix(in srgb, var(--dx-c) 10%, transparent)' : undefined,
        opacity: comparison.outcome === 'skip' ? 0.45 : 1,
        transition: 'opacity .3s, background-color .3s, border-color .3s',
      }}
    >
      <span className="font-semibold">
        {index + 1}. {criteria[index]}
      </span>
      <span style={{ color: 'var(--dx-dim)' }}>另一条规则：{comparison.rival}</span>
      <span style={{ color: 'var(--dx-dim)' }}>自定义 CSS：{comparison.mine}</span>
      {outcome.tone === undefined ? <Pill>{outcome.text}</Pill> : <Pill tone={outcome.tone}>{outcome.text}</Pill>}
    </div>
  );
}

function Scene({ item }: { item: CssCase }): JSX.Element {
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 @xl:grid-cols-2">
        <Pane title={`另一条规则：${item.rivalSource}`} role="slate" icon="file">
          <CodeLines lines={item.rivalLines} />
        </Pane>
        <Pane
          title="#gwb-theme-style 里的这条"
          role="emerald"
          icon="file"
          extra={<Pill tone={item.winner === 'mine' ? 'good' : 'bad'}>{item.winner === 'mine' ? '生效' : '被压住'}</Pill>}
        >
          <CodeLines lines={item.mineLines} />
        </Pane>
      </div>
      <div className="grid gap-2 @xl:grid-cols-3">
        {item.comparisons.map((comparison, i) => (
          <Criterion key={criteria[i]} index={i} comparison={comparison} />
        ))}
      </div>
    </div>
  );
}

export function CustomCssCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="自定义 CSS 跟谁比">
      {(item) => <Scene item={item} />}
    </CasePicker>
  );
}
