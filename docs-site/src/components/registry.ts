/**
 * 名册的名单，站这一侧的正本。mdx.tsx 用它的类型约束 React 表：组件不能多也不能少；
 * scripts/verify-roster.mjs 拿它跟 docfirst.config.mjs 里的压平表逐项核对两边。
 *
 * 只缺一边的后果不一样，但都是直接报错：**压平表没有** → 打标时报「名册外组件」；
 * **React 表没有** → 站渲染报 Expected component。
 *
 * Files / Folder / File 是 fumadocs 自己的文件树：目录树引用注入的就是它们，
 * 它们与 Note 的压平规则在 @godcreator/docfirst-workflow/fumadocs/roster 的 fumadocsRoster 里。
 * SeamMap 之后的都是自包含的讲解组件：画面与讲解文字都在 src/components/ 下各自的目录里，mdx 里只写标签；
 * 控制条与零件来自 @godcreator/docfirst-explainer。
 * registry.ts 只有可擦除的类型，Node 直接运行。
 */
export const componentNames = [
  'Note',
  'Files',
  'Folder',
  'File',
  'SeamMap',
  'ShellBootSteps',
  'PaneMountSteps',
  'OpenPaneCases',
  'LayoutBootCases',
  'DesktopSwitchSteps',
  'SubsetSheets',
  'NameIsolation',
  'TokenFlow',
  'ReactBoot',
  'AppearanceFlow',
  'CustomCssCases',
  'UpdateReloadCases',
] as const
export type ComponentName = (typeof componentNames)[number]
