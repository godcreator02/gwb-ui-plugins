/**
 * docfirst 配置：命令行和站读的是同一份。项目根是这个站目录，被引用的代码在仓根，引用写 `../plugins/<目录>/…`。
 *
 * content 是各区的上一级目录。`future/` 是未来区（路线与在途方案 `future/spec/`），不进核对；其余目录都是现状区、
 * 都进 check，本站的现状区是 `content/docs/`。轨迹卡目录是站点根的 `trajectory/`，站点的卡集合（app/features/trajectory/mdx.ts）
 * 读同一个目录。
 *
 * outputs 把正本映射到生成物：仓根 AGENTS.md / CLAUDE.md / README.md、三个插件包各自的 README.md 与随 shell 包发布的
 * 说明书 `skills/gwb-shell/SKILL.md`，正本都在 `content/docs/outputs/`。包目录里有 README.md 时 devkit 发版带它，
 * 没有才带仓根那份，所以每个包都要有自己的。改正本后运行 `pnpm doc:render`，正本与生成物放进同一个提交。
 * SKILL.md 要保留 frontmatter 的 `name` 与 `description`（gwb-skills 登记说明书时读它们），所以目标写成对象。
 * 生成正本按原文渲染，里面不能用 JSX 组件。
 *
 * fumadocsRoster 给 fumadocs 自带组件的机读规则；components 再加站里的：`Term` 是术语标注（术语表是站点根的 glossary.json），
 * 其余 13 个是自包含的讲解组件，规则读组件自己的讲解数据，把每一步、每一条写成段落。
 */
import * as seamMap from './content/docs/_shared/seam-map/seam-map.ai.mjs'
import * as shellBoot from './content/docs/shell/takeover/shell-boot/shell-boot.ai.mjs'
import * as paneMount from './content/docs/shell/takeover/pane-mount/pane-mount.ai.mjs'
import * as openPaneCases from './content/docs/shell/panes/open-pane-cases/open-pane-cases.ai.mjs'
import * as layoutBoot from './content/docs/shell/desktops/layout-boot/layout-boot.ai.mjs'
import * as desktopSwitch from './content/docs/shell/desktops/desktop-switch/desktop-switch.ai.mjs'
import * as subsetSheets from './content/docs/shell/styles/subset-sheets/subset-sheets.ai.mjs'
import * as nameIsolation from './content/docs/shell/styles/name-isolation/name-isolation.ai.mjs'
import * as tokenFlow from './content/docs/shell/tokens/token-flow/token-flow.ai.mjs'
import * as reactBoot from './content/docs/shell/react-runtime/react-boot/react-boot.ai.mjs'
import * as appearanceFlow from './content/docs/theme/startup-style/appearance-flow/appearance-flow.ai.mjs'
import * as customCssCases from './content/docs/theme/startup-style/custom-css-cases/custom-css-cases.ai.mjs'
import * as updateReload from './content/docs/baseui/update-reload/update-reload/update-reload.ai.mjs'

export default {
  content: 'content',
  trajectory: 'trajectory',
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
  fumadocsRoster: true,
  components: {
    Term: 'children',
    SeamMap: seamMap.SeamMap,
    ShellBootSteps: shellBoot.ShellBootSteps,
    PaneMountSteps: paneMount.PaneMountSteps,
    OpenPaneCases: openPaneCases.OpenPaneCases,
    LayoutBootCases: layoutBoot.LayoutBootCases,
    DesktopSwitchSteps: desktopSwitch.DesktopSwitchSteps,
    SubsetSheets: subsetSheets.SubsetSheets,
    NameIsolation: nameIsolation.NameIsolation,
    TokenFlow: tokenFlow.TokenFlow,
    ReactBoot: reactBoot.ReactBoot,
    AppearanceFlow: appearanceFlow.AppearanceFlow,
    CustomCssCases: customCssCases.CustomCssCases,
    UpdateReloadCases: updateReload.UpdateReloadCases,
  },
}
