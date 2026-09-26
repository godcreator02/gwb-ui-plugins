/**
 * 这个站的 docfirst 配置：用哪个格式包、生成物写到哪、组件名册是什么。命令行和站读的是同一份。
 *
 * 项目根是这个站目录，钉的代码在仓根——引用里写 `../plugins/<目录>/…`，按项目根拼路径，页面在哪个子目录都一样。
 * 分区按约定：`content/` 下 `trajectory/` 与 `future/` 两个名字固定，其余目录都是现状区、都进 check；
 * 本站的现状区只有 `content/docs`。
 *
 * 生成物：仓根 AGENTS.md / CLAUDE.md / README.md 与随 shell 包发布的说明书 `skills/gwb-shell/SKILL.md`，
 * 正本都在 `content/docs/outputs/`。改正本要运行 `pnpm doc:render` 重新生成，两份一起提交。
 * CLAUDE.md 第一行固定是 `@AGENTS.md`，只给 Claude 的指令写在它后面。
 * SKILL.md 要保留 frontmatter 的 `name` 与 `description`（gwb-skills 登记说明书时读它们），所以目标写成对象形式。
 * 生成正本按原文渲染，里面不能用 JSX 组件。
 */
import * as fumadocs from '@godcreator/docfirst-workflow/fumadocs'

export default {
  formats: [fumadocs],
  outputs: {
    'content/docs/outputs/agents.mdx': ['../AGENTS.md'],
    'content/docs/outputs/claude.mdx': ['../CLAUDE.md'],
    'content/docs/outputs/readme.mdx': ['../README.md'],
    'content/docs/outputs/skills/gwb-shell.mdx': [
      { to: '../plugins/shell/skills/gwb-shell/SKILL.md', frontmatter: ['name', 'description'] },
    ],
  },
  components: {
    // 讲机制的 html 动画存放在 public/，正文里的 <iframe> 在机读版里整个删掉
    iframe: 'drop',
    ...fumadocs.defaultRoster,
    // 示意图：图本身 agent 看不见，生成 markdown 时只保留「[图] 标题」和子元素里的文字说明
    Diagram: (node, h) => [h.paragraph(`[图] ${h.attr(node, 'title') ?? h.attr(node, 'name') ?? ''}`), ...h.children()],
  },
}
