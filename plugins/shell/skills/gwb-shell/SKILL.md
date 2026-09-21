---
name: gwb-shell
description: 开发或修改 gwb 插件界面时读——接入 shell 窗格、从 shadcn 官方复制组件、使用配套 tokens 和样式前缀、处理多桌面浮层与可见性。建仓、测试 home 与发版流程读 gwb-devkit。
---

# 给 gwb-shell 开发插件界面

**本页回答**：下游插件怎样接入这套 shell，并保持统一的默认视觉与交互。

shell 与 `@godcreator/gwb-tokens` 是一套 UI 平台：shell 装载页面唯一的令牌值表，插件构建期引用
tokens 的映射面。组件从 **shadcn 官方源**复制到插件自己的目录、随插件构建，按业务需要定制。
同一份令牌控制主题；复制后的组件结构与行为由插件维护，上游更新不会自动改写本地文件。

建仓和内循环读 `skill.read {"name":"gwb-devkit"}`。`devkit.scaffold` 提供浏览器半、样式入口与守卫的
起点；下面的 shadcn 配置与浮层接线按本插件需要补齐。devkit 管脚手架，本说明书管 UI 接入规则。

## 1. 接入窗格

node 半在 `gwbShell` 的 inject 回调内调用 `registerPane`，报 `id`、`title` 与本包的 `client` / `style`
地址（从自己的 `import.meta.url` 算成 `file://`）。`describeSelf` 报插件显示名。两个登记都自动随插件
卸载回收。`kind: 'tool'` 是整页至多一份的工具；文档用 `'document'`，允许多开。图标用 lucide 正名的
kebab-case；认不出的名字会记 warn，标签退成 `#`。

浏览器入口导出 `mountPane(args, container)`，返回 `{ dispose() }`；需要复用窗格切换内容时，再提供
`retarget(params)`。`args.host.call` 调命令，`args.pane` 提供窗格身份与参数，`args.shell` 提供开窗、
改标题、浮层宿主与可见性等能力。参数形状随包源码 `src/client/types.ts`；服务签名见根入口的 d.ts。

每个窗格只挂载自己的容器；`dispose` 先停止订阅与定时器、同步 `root.unmount()`，再清空容器。
`retarget` 没提供时，shell 会拆掉重挂。使用 `window.gwb` 时先 `import type {} from '@godcreator/gwb-plugin-api'`。

## 2. 从 shadcn 官方拉组件

包根的 `components.json` 按以下配置设置，`demo` 换成本插件的 CSS 前缀：

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/client/styles.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": "demo"
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "utils": "@/lib/utils"
  },
  "iconLibrary": "lucide"
}
```

样式入口先创建。包根 tsconfig 的 `paths` 把 `@/*` 指向 `./src/client/*`，供 CLI 定位；浏览器 tsconfig
与打包器也要解析到同一目录（浏览器 tsconfig 在 `src/client/` 时写 `./*`）。这是包内别名，不指回别的仓。
在包目录用 `shadcn add` 从官方源添加需要的组件，拉取后检查类名前缀及样式入口，保留下一节的五行形状。

常见按钮、输入、选择、菜单、弹窗优先使用拉下来的官方组件，保留默认状态与键盘交互，尺寸从组件现有
variant 选。业务特有界面可以定制，但工具栏、设置表单、提示状态等公共部分仍消费语义令牌。
CLI 添加的组件依赖打进浏览器束，按本生态规则放 devDependencies。`cn` 若由 CLI 直接导入，保留该入口，
无需为配置里的 utils 别名另造一份函数。

## 3. 接上 tokens 与样式前缀

`src/client/styles.css` 的五行入口（`demo` 与 `components.json` 一致）：

```css
@import 'tailwindcss/theme.css' theme(reference) prefix(demo);
@import '@godcreator/gwb-tokens/theme.reference.css' theme(reference);
@import 'tailwindcss/utilities.css' layer(utilities) source(none);
@import 'tw-animate-css';
@source "./";
```

构建 `tailwindcss -i src/client/styles.css -o dist/style.css`。页面值表、preflight 与层顺序由 shell 装载，
插件只编自己的规则；不要把 tokens 的 `theme.css` 或整份 Tailwind preflight 再打进插件样式。
React 的四个裸名 `react` / `react/jsx-runtime` / `react-dom` / `react-dom/client` 由页面 importmap 提供，
构建时外置；普通组件依赖打进本束。其他裸名只有确认宿主 importmap 提供时才能外置。

CSS 前缀只用小写字母，脚手架按插件短名剔除其他字符。前缀排在变体前面，如 `demo:hover:bg-accent`；
`group` / `peer` 标记也带前缀。漏前缀或顺序错会静默不生成规则，标记类的漏写不能只靠前缀守卫发现。
窗格容器是容器查询根，布局用 `demo:@sm:…` 等容器变体，按窗格宽度而非窗口宽度判断；检查官方组件
带来的视口断点是否符合用途。新增源码扫描目录时明确补 `@source`，不扫描 dist。

颜色按用途选：

* 跨插件、跟主题的语义色用 `background`、`foreground`、`primary`、`muted`、`destructive`、`warning`
  等语义类；选中、警告、危险不是装饰，不能绕到出厂调色板或写死颜色。
* 插件特有、多处使用的视觉概念放 `src/client/tokens.css`：变量带插件前缀，优先派生全局令牌。
  挂 `:root` 让浮层可继承，需要暗色覆盖时用 `.dark`；在入口 import 值段，尾部用 `@theme inline`
  映射成插件工具类。只声明自己的变量，不覆盖全局语义令牌。
* 一次性且不随主题的装饰可明示任意值，如 `demo:bg-[#abc]`。

映射面的刻度以 `@godcreator/gwb-tokens/theme.reference.css` 为准。没有映射的语义先找既有语义；
确需跨插件共用再补 tokens。局部尺寸可用任意值，不能靠字面 fallback 掩盖缺失的公共令牌。
新增令牌的消费者需要匹配的 tokens 运行时版本；改已有令牌值则通过页面共享表生效。

## 4. 浮层与多桌面

**窗格里的浮层挂到 `args.shell.portal`。** 类名前缀只保证浮层样式生效；挂到 body 的浮层不属于任何
桌面，切桌面后可能仍然可见。官方组件若在 Content 内部创建 Portal，就给本地 Content 增加可选
`container?: HTMLElement` 并透传到 Radix Portal，然后使用：

```tsx
<SelectContent container={args.shell.portal}>…</SelectContent>
```

`container` 是本地适配，不能假定官方 Content 已有这个参数。Dialog、AlertDialog、DropdownMenu、
Popover 等包含 Portal 的组件逐个检查。可参考本仓 `plugins/baseui/src/client/components/ui/` 的接线；
插件不要依赖 baseui 的运行时组件。

桌面隐藏时窗格仍保活。有轮询、媒体或持续渲染的界面，用 `args.shell.onVisibility` 暂停与恢复；它注册
时先通知当前状态，注销函数在 `dispose` 时调用。隐藏不等于卸载，不在可见性回调中清空业务状态。

## 5. 验收

先 build，再运行插件的 check，让产物守卫检查本次产物：前缀选择器、零字面 fallback、浏览器裸名与
资源完整性。颜色类白名单按 tokens 映射面与本插件 `@theme` 现扫，参考 shell / baseui 的
`tests/artifact.test.ts`；脚手架尚未默认包含这项，需要补上。升级 Tailwind 时复核映射面和全局机制的兼容性。

经 `gwb-devkit` 在隔离 home 验收：亮暗两套主题；窄窗格与宽窗格；控件 hover / focus / disabled / error；
键盘操作；打开浮层后切桌面；关闭再开窗格，以及文档多开时互不影响。控制台与日志无资源加载、卸载错误。
这些通过后才算 UI 接入完成；测试仅检查源码或没有 dist 时跳过产物，不能代替这一步。

维护本规则时，现状原理见 UI 平台仓 `docs-site/content/docs/styles.mdx`，令牌归属与演进规则见
`docs-site/content/docs/tokens.mdx`。接入协议变化要同步检查 devkit 模板；模板消费规则，不另立 UI 规范。
