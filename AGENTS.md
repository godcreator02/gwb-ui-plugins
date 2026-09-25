# gwb-ui-plugins

**本页回答**：在这个仓干活的 agent 先看什么、怎么跑、门禁是哪几条、什么碰不得。

## 这个仓是什么

**gwb 的 UI 平台仓**。立场：**shell 是一个 UI 平台的整体，要换整套换**；令牌表（视觉契约）并在 shell 包里，
页面用的 react 由内核包提供，不为假想的第二外壳实现维护独立契约包。`gwb-tokens` / `gwb-shared-react` 两个
共享包已停发，registry 上的旧版别再引。

|      | 插件 / 包                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------- |
| 外壳   | `shell`（窗格容器 + 窗格注册服务，内核页面根的唯一入口；子路径 `theme.css` / `theme.reference.css` 提供令牌表；页面用的 react 由内核包提供） |
| 外观   | `theme`（全局启动样式 + 外观窗格；没外壳也照常加载）                                                                   |
| 基础界面 | `baseui`（基础插件的官方窗格集：日志、插件管理）                                                                      |

## 依赖现状

* **用到的插件写 peer**：跨仓的（命令总线、数据、设置、说明书、日志、插件管理）写 `^<源上 latest>`，
  同仓的（shell / theme / baseui 之间）写 `workspace:^`；可选使用的在 `peerDependenciesMeta` 标 `optional: true`，
  不另写 dev。peer 里还有内核包 `@godcreator/gwb-kernel-desktop`，接口类型从它的包根 `import type`
* 依赖单向：本仓用基础仓，基础仓不依赖本仓

## baseui 三条规矩（破了任何一条，它就会变成什么都往里放的上帝插件）

1. 对每个 core 服务**一律局部注入**（`ctx.inject([...], fn)`），必需依赖只有 `gwbShell`——缺了哪个服务就不注册对应的窗格
2. **一窗格一模块**：`panes/` 下窗格之间零 import，只准 import `components/ui` 共享层
3. **只收拆掉了界面的 core 插件的窗格**：进 baseui 的唯一资格是它是某个 core 插件的官方界面；界面本身就是全部
   功能的插件（hello、将来的功能插件）自带界面，不进

## 先读

`docs-site/content/docs/`：[系统地图](docs-site/content/docs/system-map.mdx) → 要改的那块的页 →
[术语表](docs-site/content/docs/glossary.mdx)。在途的活在 `docs-site/content/spec/`。写插件、在隔离 home
里验证读 skill「gwb-devkit」，升版本号、发版读 skill「gwb-release」，写文档读 skill「docfirst-docs」
（随插件 `@godcreator/gwb-docfirst-workflow` 发布）。

## 怎么跑

```bash
pnpm install
pnpm check        # typecheck + lint + test
```

下游 UI 接入规范随 shell 的 `gwb-shell` skill 发布；正本是 `content/outputs/skills/gwb-shell.mdx`，
由本站 render 到 `plugins/shell/skills/`。改接入要求时同步检查 devkit 模板。

## 门禁

提交前都要绿：`pnpm check`；文档检查单独 `cd docs-site && pnpm doc`。

## 红线

* 这份 AGENTS.md 是生成物，正本是 `docs-site/content/outputs/agents.mdx`，改那边
