/**
 * 示意图：`<Diagram name="…" title="…">文字说明</Diagram>`。
 *
 * 人看到的是 `name` 对应的那张 SVG，agent 读生成的 markdown 看到的是 title 与子元素里的文字说明
 * （docfirst.config.mjs 里 Diagram 的规则只保留这两样）。所以说明文字要能单独读懂：图画的是什么、
 * 谁连着谁，文字里都要有。图不在 docfirst 的检查范围里，图里的名字改了代码要自己对照着改。
 * 这套组件复制自基础插件仓文档站，各站各有一份。
 */
import type { ReactNode } from 'react'
import './diagram.css'
import { BaseuiPanes } from './diagrams/baseui-panes'
import { DesktopSwitch } from './diagrams/desktop-switch'
import { ImportmapFlow } from './diagrams/importmap-flow'
import { ModuleDeps } from './diagrams/module-deps'
import { NameIsolation } from './diagrams/name-isolation'
import { PaneLayout } from './diagrams/pane-layout'
import { PaneMount } from './diagrams/pane-mount'
import { ShellTakeover } from './diagrams/shell-takeover'
import { ThemeFlow } from './diagrams/theme-flow'
import { TokenFlow } from './diagrams/token-flow'

const drawings: Record<string, () => ReactNode> = {
  'shell-takeover': () => <ShellTakeover />,
  'pane-mount': () => <PaneMount />,
  'pane-layout': () => <PaneLayout />,
  'desktop-switch': () => <DesktopSwitch />,
  'importmap-flow': () => <ImportmapFlow />,
  'token-flow': () => <TokenFlow />,
  'theme-flow': () => <ThemeFlow />,
  'baseui-panes': () => <BaseuiPanes />,
  'module-deps': () => <ModuleDeps />,
  'name-isolation': () => <NameIsolation />,
}

export function Diagram({ name, title, children }: { name: string; title?: string; children?: ReactNode }) {
  const draw = drawings[name]
  if (draw === undefined) throw new Error(`没有叫「${name}」的图：src/components/diagram.tsx 的 drawings 表里没有登记`)
  return (
    <figure className="diagram">
      {title !== undefined && <figcaption className="diagram-title">{title}</figcaption>}
      <div className="diagram-canvas">{draw()}</div>
      {children !== undefined && <div className="diagram-text">{children}</div>}
    </figure>
  )
}
