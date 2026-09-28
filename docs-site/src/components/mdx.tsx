/**
 * 名册里给人看的那一半：docfirst.config.mjs 里声明压平表，这里给 React 表。
 * 表的类型由 registry.ts 的名单固定：少一个编译不过，多一个也编译不过。
 * 跟压平表是否一致，由 scripts/verify-roster.mjs 核对两边。
 * 以 fumadocs 的默认表为底，再把 pre 换成 @godcreator/docfirst-workflow/fumadocs 里会画状态点的 DocfirstPre。
 */
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { DocfirstPre } from '@godcreator/docfirst-workflow/fumadocs/pre';
import type { ComponentName } from './registry';
import { SeamMap } from './seam-map/seam-map';
import { ShellBootSteps } from './shell-boot/shell-boot';
import { PaneMountSteps } from './pane-mount/pane-mount';
import { OpenPaneCases } from './open-pane-cases/open-pane-cases';
import { LayoutBootCases } from './layout-boot/layout-boot';
import { DesktopSwitchSteps } from './desktop-switch/desktop-switch';
import { SubsetSheets } from './subset-sheets/subset-sheets';
import { NameIsolation } from './name-isolation/name-isolation';
import { TokenFlow } from './token-flow/token-flow';
import { ReactBoot } from './react-boot/react-boot';
import { AppearanceFlow } from './appearance-flow/appearance-flow';
import { CustomCssCases } from './custom-css-cases/custom-css-cases';
import { UpdateReloadCases } from './update-reload/update-reload';

export function Note({ children }: { children?: ReactNode }) {
  return <div className="note">{children}</div>;
}

const table: Record<ComponentName, MDXComponents[string]> = {
  Note,
  Files,
  Folder,
  File,
  SeamMap,
  ShellBootSteps,
  PaneMountSteps,
  OpenPaneCases,
  LayoutBootCases,
  DesktopSwitchSteps,
  SubsetSheets,
  NameIsolation,
  TokenFlow,
  ReactBoot,
  AppearanceFlow,
  CustomCssCases,
  UpdateReloadCases,
};

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...components,
    ...table,
    pre: DocfirstPre,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
