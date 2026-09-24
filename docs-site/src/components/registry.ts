/**
 * MDX 组件名单，站这一侧的正本。mdx.tsx 用它的类型要求 React 组件表不多不少正好这几个；
 * scripts/verify-roster.mjs 拿它跟 docfirst.config.mjs 里 `components` 的转换规则逐个核对。
 *
 * 两边缺一边都是硬失败，但表现不同：**转换规则里没有** → 生成 markdown 时报「名册外组件」；
 * **React 组件表里没有** → 站渲染时报 Expected component。
 *
 * Files / Folder / File 是 fumadocs 自己的文件树组件：目录树引用生成的就是它们，
 * 转换规则在格式包的默认表里。Diagram 是示意图（src/components/diagram.tsx）。
 * 这个文件只有能被擦除的类型写法，Node 可以直接 import 它。
 */
export const componentNames = ['Note', 'Files', 'Folder', 'File', 'Diagram'] as const
export type ComponentName = (typeof componentNames)[number]
