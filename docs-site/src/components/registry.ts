/**
 * 名册的名单，站这一侧的正本。mdx.tsx 用它的类型逼着 React 表一个不多一个不少；
 * scripts/verify-roster.mjs 拿它跟 docfirst.config.mjs 里的压平表两头对。
 *
 * 少一半的后果不一样，但都是硬失败：**压平表没有** → 打标时报「名册外组件」；
 * **React 表没有** → 站渲染报 Expected component。
 *
 * Files / Folder / File 是 fumadocs 自己的文件树：目录树引用注入的就是它们，
 * 它们与 Note 的压平规则在 @godcreator/docfirst-workflow/fumadocs/roster 的 fumadocsRoster 里。
 * Diagram 是示意图（src/components/diagram.tsx）。
 * registry.ts 只有可擦除的类型，Node 直接运行。
 */
export const componentNames = ['Note', 'Files', 'Folder', 'File', 'Diagram'] as const
export type ComponentName = (typeof componentNames)[number]
