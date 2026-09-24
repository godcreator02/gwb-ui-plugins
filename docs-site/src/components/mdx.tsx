/**
 * MDX 组件的 React 表：站上渲染每个组件用什么。生成 markdown 时每个组件变成什么文字，写在
 * docfirst.config.mjs 的 `components` 里；两边的名单由 registry.ts 定，类型保证这张表不多不少，
 * 两边是否一致由 scripts/verify-roster.mjs 核对。
 * 先铺 fumadocs 的默认组件，再加上本站的组件，最后把 pre 换成格式包里会显示引用状态的那个。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { File, Files, Folder } from 'fumadocs-ui/components/files'
import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import { DocfirstPre } from '@godcreator/docfirst-workflow/fumadocs/pre'
import { Diagram } from './diagram'
import type { ComponentName } from './registry'

type Loose = MDXComponents[string]

export function Note({ children }: { children?: ReactNode }) {
  return <div className="note">{children}</div>
}

const table: Record<ComponentName, Loose> = {
  Note: Note as Loose,
  Files: Files as Loose,
  Folder: Folder as Loose,
  File: File as Loose,
  Diagram: Diagram as Loose,
}

export function getMDXComponents(components: MDXComponents = {}): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    ...table,
    pre: DocfirstPre as unknown as NonNullable<MDXComponents['pre']>,
  }
}
