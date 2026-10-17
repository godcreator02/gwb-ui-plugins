/**
 * 「按位置隔离与按名字隔离」：选一种情况，看一条规则在页面的 DOM 树上命中了哪些元素、漏了哪些、错命中了哪些。
 * 讲解文字与 DOM 树都在 name-isolation.data.mjs，机读版由 name-isolation.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Pill } from '@godcreator/explainer/site';
import type { Role } from '@godcreator/explainer/site';
import { cases, nodes } from './name-isolation.data.mjs';
import './name-isolation.css';

type IsolationCase = (typeof cases)[number];

const ownerRole: Record<string, Role> = { shell: 'blue', baseui: 'emerald', none: 'slate' };

function stateOf(current: IsolationCase, id: string): 'missed' | 'leaked' | 'matched' | 'none' {
  if (current.missed.includes(id)) return 'missed';
  if (current.leaked.includes(id)) return 'leaked';
  if (current.matched.includes(id)) return 'matched';
  return 'none';
}

function Badge({ state }: { state: ReturnType<typeof stateOf> }): JSX.Element | null {
  if (state === 'matched') return <Pill tone="good" dot>命中</Pill>;
  if (state === 'missed') return <Pill tone="bad" dot>该命中，没命中</Pill>;
  if (state === 'leaked') return <Pill tone="bad" dot>不该命中，命中了</Pill>;
  return null;
}

function Tree({ current }: { current: IsolationCase }): JSX.Element {
  const faulty = current.missed.length + current.leaked.length > 0;
  return (
    <div className="ni-scene">
      <div className="ni-rule" data-role={ownerRole[current.owner]}>
        <span className="ni-rule-label">{current.mode === 'bare' ? '按位置隔离的规则' : '按名字隔离的规则'}</span>
        <code>{current.selector} {'{ … }'}</code>
      </div>
      <Pane title="页面的 DOM（简化）" role="slate">
        <ul className="ni-tree">
          {nodes.map((node) => {
            const state = stateOf(current, node.id);
            return (
              <li
                key={node.id}
                className="ni-node"
                data-state={state}
                data-role={ownerRole[node.owner]}
                style={{ paddingLeft: node.depth * 18 }}
              >
                <code className="ni-tag">{current.mode === 'bare' ? node.bare : node.prefixed}</code>
                {node.note !== '' ? <span className="ni-note">{node.note}</span> : null}
                <Badge state={state} />
              </li>
            );
          })}
        </ul>
      </Pane>
      {/* 每种情况换 key，结论胶囊重新挂载，弹出动画重放一次 */}
      <Pill key={current.id} tone={faulty ? 'bad' : 'good'} dot>
        {faulty ? '静默出错：构建通过、控制台没有报错' : '只命中本插件画的元素'}
      </Pill>
    </div>
  );
}

export function NameIsolation(): JSX.Element {
  return (
    <CasePicker cases={cases} label="选一条规则">
      {(current) => <Tree current={current} />}
    </CasePicker>
  );
}
