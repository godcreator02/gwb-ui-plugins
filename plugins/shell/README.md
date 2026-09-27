# @godcreator/gwb-shell

## 是什么

gwb 工作台的外壳：接管内核页面的根元素，提供窗格容器（多张桌面、每张桌面上分组的标签页）和窗格注册服务
`gwbShell`。插件经 `gwbShell` 登记窗格，外壳在用户打开时加载插件的浏览器侧代码、调它导出的 `mountPane`。
包里还带着界面的令牌表和写插件界面的说明书。

装进一个 home：`plugin-manager.install {"pkg":"@godcreator/gwb-shell"}`。

## 写带界面的插件时怎么用

- **先读说明书**：`skill.read {"name":"gwb-shell"}`。加窗格、做文档窗格、在窗格里调命令、接 shadcn 组件、
  用令牌配颜色、写浮层、视觉验收的步骤与完成判据都在那里
- **peer 写外壳**：`@godcreator/gwb-shell`，范围 `^x.y.z`
- **node 侧类型从包根 `import type`**：包根只导出服务接口 `GwbShellApi` 与登记用的 `PaneSpec`、`PluginInfo`，
  命令名不导出，调命令时直接写名字。包根的类型声明给
  cordis 的 `Context` 补了 `gwbShell` 这一项，源码里 `import type` 过包根，`ctx.gwbShell` 就有类型；
  用它的插件写 `export const inject = ['gwbShell']`
- **浏览器侧类型从子路径 `@godcreator/gwb-shell/pane` `import type`**：`PaneArgs`、`PaneHandle`、`ShellBridge`、
  `HostBridge`、`OpenPaneOptions`、`Placement`、`PaneKind`、`PaneContent`。这个子路径只有类型，按值 import 在构建时报错
- **令牌表**：插件的样式入口写 `@import '@godcreator/gwb-shell/theme.reference.css' theme(reference);`，
  可用的语义颜色名与刻度以这份文件为准。页面上的令牌值（`theme.css`）由外壳自己加载，插件不引
- **命令**：外壳的命令（打开窗格、列出开着的窗格、桌面操作）与参数形状看 `search {"plugin":"@godcreator/gwb-shell"}`
