/**
 * docfirst 配置：命令行和站读的是同一份。项目根是这个站目录，被引用的代码在仓根，引用写 `../plugins/<目录>/…`。
 *
 * content 是各区的上一级目录。它下面只有两个名字是固定的：`trajectory/` 是轨迹卡目录，
 * `future/` 是未来区（路线、在途方案 `future/spec/`、别的仓投来的反馈 `future/inbox/`）。
 * 其余目录都是现状区，全部进 check；本站的现状区是 `content/docs/`。
 *
 * outputs 把正本映射到生成物：仓根 AGENTS.md / CLAUDE.md / README.md、三个插件包各自的 README.md 与随 shell 包发布的说明书
 * `skills/gwb-shell/SKILL.md`，正本都在 `content/docs/outputs/`。包目录里有 README.md 时 devkit 发版带它，
 * 没有才带仓根那份，所以每个包都要有自己的。改正本后运行 `pnpm doc:render`，正本与生成物放进同一个提交。
 * SKILL.md 要保留 frontmatter 的 `name` 与 `description`（gwb-skills 登记说明书时读它们），所以目标写成对象。
 * 生成正本按原文渲染，里面不能用 JSX 组件。
 *
 * components 是组件名册，fumadocsRoster 给 fumadocs 自带文件树 Files / Folder / File 与 Note 的压平规则，
 * 站里自己加的组件在它后面追加。
 */
import { fumadocsRoster } from '@godcreator/docfirst-workflow/fumadocs/roster'

export default {
  content: 'content',
  outputs: {
    'content/docs/outputs/agents.mdx': ['../AGENTS.md'],
    'content/docs/outputs/claude.mdx': ['../CLAUDE.md'],
    'content/docs/outputs/readme.mdx': ['../README.md'],
    'content/docs/outputs/packages/shell.mdx': ['../plugins/shell/README.md'],
    'content/docs/outputs/packages/theme.mdx': ['../plugins/theme/README.md'],
    'content/docs/outputs/packages/baseui.mdx': ['../plugins/baseui/README.md'],
    'content/docs/outputs/skills/gwb-shell.mdx': [
      { to: '../plugins/shell/skills/gwb-shell/SKILL.md', frontmatter: ['name', 'description'] },
    ],
  },
  components: {
    ...fumadocsRoster,
    iframe: 'drop',
    // 示意图：机读版只保留「[图] 标题」和子元素里的文字说明
    Diagram: (node, h) => [h.paragraph(`[图] ${h.attr(node, 'title') ?? h.attr(node, 'name') ?? ''}`), ...h.children()],
  },
}
