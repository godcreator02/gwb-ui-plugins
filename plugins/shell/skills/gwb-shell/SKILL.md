---
name: gwb-shell
description: 写 gwb 插件的窗格、在窗格里调命令、接 shadcn 组件、用主题令牌配颜色、写弹窗与菜单等浮层、做界面视觉验收时读。
---

# 写 gwb 插件的界面

**本页回答**：带界面的插件怎样接进外壳的窗格、组件、令牌与浮层，做完怎样验收。

建仓、改完装进测试 home 查看（`devkit.dev`）、测试 home 与发版读 `skill.read {"name":"gwb-devkit"}`。下面各节从
`devkit.scaffold` 生成的插件出发：它已带一个窗格和样式入口 `src/client/styles.css`。模板里的 `registerPane` 只写了
`id`、`title`、`client`、`style`，也没有调 `describeSelf`：下一节第 1 步的 `icon`、`kind` 和第 2 步照这里补上。

## 浏览器依赖

构建从 `@godcreator/gwb-shell/browser-imports` 导入 `browserImports()`，以它的键作为 external；peer 的 shell 版本必须带这个出口。React 的产物和版本由 shell 提供。shell 加载窗格前会 prepareImports；使用额外提供方时写明 peer，并用 cordis 注入保证其先登记。已注入地址变更后整页重载。

## 给插件加一个窗格

1. node 侧 `inject` 写上 `'gwbShell'`，在 `apply` 里调 `ctx.gwbShell.registerPane({ id, title, icon, kind, client, style })`：
   - `id` 非空、不含 `:`，本插件内唯一；`title` 非空。不满足的 `registerPane` 当场抛错
   - `client` / `style` 从本模块地址算：`new URL('./client.js', import.meta.url).href`、`new URL('./style.css', import.meta.url).href`。
     给了就必须是 `file://` 地址、路径分别以 `.js` / `.css` 结尾，否则 `registerPane` 当场抛错
   - `icon` 写 lucide 图标页上的名字，kebab-case，如 `layout-grid`；认不出的名字照样注册，标签上显示 `#`
   - `kind` 写 `'tool'`（缺省）或 `'document'`：工具窗格整页至多一份，打开就是显示它；文档窗格每份装一个内容，可以开多份（见下一节）。
     写了这两个以外的值，`registerPane` 当场抛错

   外壳在本插件卸载时自动注销这个窗格；返回的注销函数只在要提前注销时调。
2. 调 `ctx.gwbShell.describeSelf({ title, icon })` 报插件的显示名，状态栏「新建」按它给窗格分组。
3. 浏览器侧 `src/client/index.tsx` 导出 `mountPane`，参数与返回值的类型从外壳的子路径 `@godcreator/gwb-shell/pane` 引：

   ```tsx
   import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'

   export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
   ```

   在 `container` 里 `createRoot` 渲染；返回的 `dispose` 依次停掉订阅与定时器、同步 `root.unmount()`、清空 `container`。
   这些类型不在自己代码里手写，也不用 `as` 转成它们；peer 里外壳的版本要带 `./pane` 子路径（外壳 `package.json` 的 `exports` 里有它）。

   一个插件有几个窗格就调几次 `registerPane`，每次换一个 `id`，`client` 与 `style` 可以都给同一对地址：
   同一个样式表地址只注入页面一次，之后不再注入、也不移除；同一个 `client.js` 地址按 ES 模块只加载一次，
   模块顶层的变量由这个插件的所有窗格、所有份共用，整页重载后重新开始。`mountPane` 里按 `args.pane.id` 分开处理：

   ```tsx
   export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
     const root = createRoot(container)
     root.render(args.pane.id === 'settings' ? <SettingsPane args={args} /> : <MainPane args={args} />)
     return {
       dispose() {
         root.unmount()
         container.replaceChildren()
       },
     }
   }
   ```
4. 运行时要改这个窗格标签上的标题，调 `args.shell.setPaneTitle(title)`；初始标题是 `registerPane` 的 `title`。
   在 `mountPane` 里直接调、或挂载后在组件的 effect 里调都有效。标题随布局保存：整页重载、重启之后标签上还是最后设的那个，
   不用在重新挂载时再设一次。
5. 窗格的根元素不用自己铺底色和文字色：窗格所在的组底色已是 `--background`，文字色从 `body` 继承 `--foreground`
   （外壳令牌表里的 `body` 规则）。要换底色（如 `bg-card`、`bg-muted`）时，在根元素上把底色和对应的文字色成对写上：
   `demo:bg-card demo:text-card-foreground`。
6. 窗格里有轮询、动画或媒体时，用 `args.shell.onVisibility((visible) => …)` 在 `false` 时暂停、`true` 时恢复。
   它注册时先回调一次当前值；返回的注销函数在 `dispose` 里调。切到别的桌面后窗格不卸载，业务状态照常保留。
7. 把这一版装进隔离 home：`devkit.dev {"home":"<home 名>","dir":"<仓根>","packages":["plugins/<短名>"]}`
   （`packages` 必给，相对仓根的插件包目录）。

**完成**：`devkit.dev` 回执 `ok: true`；`devkit.cdp {"args":["<home 名>","cmd","shell.panes"]}` 的回执里有这个窗格，
`entryId` 是本插件的条目、`kind` 是你写的那一类；`gwb.log` 有一行「窗格 `<id>`（…）登记上了（`<包名>`）」，没有点名这个窗格的 warn；
从状态栏「新建」打开它，窗格里显示出内容。

## 做能多开的文档窗格

1. 注册时写 `kind: 'document'`。
2. 打开一份：`args.shell.openPane(paneId, { key, params, preview, placement })`。新窗格开在调用它的这个窗格所在的桌面上，
   不切桌面。放进哪一组，按顺序取第一条成立的：
   - 调用它的就是同一个窗格（同一插件、同一窗格 id）：放进调用方自己那一组
   - 这张桌面上有已开着这个窗格的组：放进其中最近激活过的那一组
   - 调用方右边紧挨着有一组：放进那一组；右边没有，就把调用方那一组对半分出一组新的

   `placement: 'side'` 跳过前两条，直接按第三条开到调用方右边。`key` 是这份内容的身份，目标组里已开着同一 `key`
   的就激活那一份，别的组、别的桌面开着的不算；`params` 原样交给那一份的 `mountPane`（`args.pane.params`），
   并随布局保存；`preview: true` 开成预览窗格，同一组里下一次预览打开会原地换掉它的内容。
   `key` 取内容本身的身份（文件路径、记录 id），不要用插件里的计数器：整页重载后插件模块重新加载、计数器归零，
   新开的一份会和布局里恢复出来的旧份用上同一个 `key`，目标组里有那一份时打开的就是旧的那份、不开新的。
   打开别的插件的窗格用命令 `shell.openPane`，带上 `from`（自己的 `args.pane.instance`）才按上面的规则算；
   不带 `from` 时，没有已开着这个窗格的组就放进活动组（参数见 `search {"plugin":"@godcreator/gwb-shell"}`）。
3. 需要在换内容时保住滚动位置、输入到一半的字，就在句柄上加 `retarget(params)`：外壳换了这一份的 `params`
   后调它；句柄上没有 `retarget` 时，外壳卸载后重新挂载这一份。
4. 用户在窗格里原地换了内容（点链接跳转、后退）后，调 `args.shell.setPaneContent({ key, params, title })` 上报。
5. 用户开始编辑预览窗格时调 `args.shell.keepPane()`，把它变成正式窗格。
6. 窗格里的链接按统一的手势打开，同一个手势在所有插件里意思一样：
   - 在同类文档窗格里单击：本窗格原地换内容，换完调 `setPaneContent`
   - 在别的窗格里单击：`openPane(…, { preview: true })`
   - Ctrl / ⌘ + 单击或中键：`openPane(…)`，不要预览，开一个新标签并激活它
   - Ctrl / ⌘ + Alt / ⌥ + 单击：`openPane(…, { placement: 'side' })`
   - 悬停或点记号弹出的浮动卡片预览由插件自己画，不开窗格

**完成**：两个不同 `key` 开出两份，各自拿到自己的 `params`；从同一个窗格再打开同一 `key` 是激活已开的那份；
`shell.pane.list` 回执里每份的 `key` 是最后上报的那个；`shell.reload` 整页重载后每份的内容还在。

## 在窗格里调命令

1. 用 `args.host.call(name, args)`。它就是页面上的 `window.gwb.command`：经 IPC 交给主进程，由命令总线
   `ctx.gwbCommands.run` 执行，回的是命令总线的回执，形状见说明书 `gwb-commands` 的「回执参考」。
2. 命令没成功时 promise 照常 resolve，回执是 `{ ok: false, error }`，不会 reject：
   - 命令不存在：`error` 是 `没有这条命令：<命令名>`
   - 处理函数抛错：`error` 是异常文本
   - 处理函数自己返回 `{ ok: false, error }`：原样返回

   只有参数或返回值过不了 IPC（里面有函数这类不能结构化克隆的值）时调用本身才抛错，所以参数只放能 JSON 序列化的值。
3. 回执类型用内核包的 `GwbResult`，先看 `ok` 再取 `data`；失败时把 `error` 显示在窗格里，不要吞掉换成空数据：

   ```tsx
   import type { GwbResult } from '@godcreator/gwb-kernel-desktop'
   import type { HostBridge } from '@godcreator/gwb-shell/pane'

   async function listRows(host: HostBridge): Promise<Row[]> {
     const reply = (await host.call('demo.list', { limit: 20 })) as GwbResult<Row[]>
     if (!reply.ok) throw new Error(`demo.list 没成功：${reply.error ?? '回执没写原因'}`)
     return reply.data ?? []
   }
   ```

   调用处 `catch` 住，把错误文本放进窗格的状态里显示出来。`as GwbResult<Row[]>` 只是给类型，不检查 `data` 实际长什么样：
   先用 `search` 看那条命令的 `usage`，`usage` 没写清 `data` 形状的，在隔离 home 里用 `devkit.cdp … cmd <命令名>` 调一次看实际回执，
   再按看到的形状收窄。处理函数返回带 `ok` 又有别的字段的对象时（命令行工具的命令都是这种），字段在回执顶层、不在 `data` 里。

**完成**：命令成功时窗格显示出 `data` 里的内容；把命令名故意写错一次，窗格上显示出「没有这条命令：…」，
页面没有未处理的 promise 报错。故意写错的那一次会在 `gwb.log` 留一行「调用了不存在的命令：…」的 warn，这是预期的。

## 接入 shadcn 组件

1. 包根写 `components.json`（形状见下文「参考」），`tailwind.prefix` 填本插件的 CSS 前缀，即样式入口第一行
   `prefix(…)` 里那个。
2. 配 `@/` 别名，三处都指向 `src/client`：
   - 包根 `tsconfig.json`：`"paths": { "@/*": ["./src/client/*"] }`（shadcn CLI 按它决定组件放在哪）
   - `src/client/tsconfig.json`：`"paths": { "@/*": ["./*"] }`（类型检查）
   - `build.ts` 的 esbuild 选项：`alias: { '@': path.join(here, 'src', 'client') }`（打包）

   只写 `paths`，TS 7 已移除 `baseUrl`。
3. 在插件包目录（`plugins/<短名>/`，`components.json` 所在的那一层）运行 `pnpm dlx shadcn@latest add <组件…>`，
   如 `pnpm dlx shadcn@latest add button select dialog`，从官方源添加组件。
4. 把 CLI 写进 `dependencies` 的组件依赖（常见的有 `radix-ui`、`cn`，有的组件还有 `class-variance-authority`）
   挪到 `devDependencies`：它们打包进 `client.js`。组件里的 `import { cn } from 'cn'` 保持原样。
   CLI 不一定把组件用到的包都装上（实测 `select`、`dropdown-menu` 用了 `lucide-react`，CLI 没装）：逐个看生成的组件文件顶部的 import，
   `package.json` 里没有的自己 `pnpm add -D <包名>`。
5. 按钮、输入、选择、菜单、弹窗用添加进来的官方组件，保留它们的默认状态与键盘交互，尺寸从已有的
   variant 里选。业务特有的界面可以自己写，工具栏、设置表单、提示这些公共部分照常用语义类。

**完成**：组件文件在 `src/client/components/ui/` 下（包根下没有一个名字就叫 `@` 的目录）；`pnpm check` 全绿；
`devkit.dev` 回执 `ok: true`。

## 用令牌配颜色与布局

1. 样式入口保持下文「参考」里的五行，前缀与 `components.json` 一致。
2. 每个类名都带前缀，前缀排在所有变体前面：`demo:hover:bg-accent`、`demo:@sm:flex-row`。`group` / `peer`
   这类标记类同样带前缀，标记类和用它的变体都要带：`demo:group` 配 `demo:group-hover:…`。
3. 颜色按用途选：
   - 跨插件、随主题变的（背景、前景、主色、选中、警告、危险）：语义类，如 `bg-background`、`text-foreground`、
     `bg-primary`、`text-muted-foreground`、`text-destructive`、`text-warning`。可用的名字与刻度以
     `@godcreator/gwb-shell/theme.reference.css` 为准
   - 只有本插件有、多处用到的视觉概念：写进 `src/client/tokens.css`——变量名带插件前缀、声明在 `:root`、
     值优先派生全局令牌（如 `var(--accent)`），暗色覆盖写在 `.dark` 下；样式入口 import 它，末尾用
     `@theme inline { --color-<名>: var(--<变量>) }` 映射成本插件的工具类
   - 只用一次、不随主题变的装饰：任意值，如 `demo:bg-[#abc]`
4. 按窗格宽度排版：窗格容器是容器查询的根，响应式用 `demo:@sm:`、`demo:@md:` 这类容器变体；官方组件里的
   视口断点（`sm:`、`md:`）要跟窗格宽度走的，改成容器变体。
5. 需要一个跨插件共用、映射文件 `theme.reference.css` 里又没有的语义时，先找现有语义；确实要新增，就提给外壳的令牌表（UI 平台仓
   `gwb-ui-plugins` 的 `plugins/shell/src/tokens/`），外壳发版后把 peer 里外壳的下限升到带这个令牌的版本。

**完成**：`devkit.dev` 回执 `ok: true`。它在构建之后跑样式检查：类选择器带前缀、前缀排在变体前面、没有
`data-gwb-plugin`、`var()` 不写死 fallback、颜色类只用令牌、`.tsx` 里没有漏前缀；有一条没过就回 `ok: false`、
逐条写明怎么改，不装进 home。

## 写浮层（弹窗、菜单、下拉、提示）

1. 在 `src/client/components/ui/` 里搜 `Portal`，逐个找出用到它的组件：Dialog、AlertDialog、DropdownMenu、ContextMenu、
   Select、Popover、Tooltip 等。
2. 给每个这样的组件的 Content 函数加可选参数 `container?: HTMLElement`，透传给包着内容的那个 Portal。官方组件没有这个参数，
   这是本地改动，只改三处：参数解构里加 `container`、参数类型后面并上 `& { container?: HTMLElement }`、
   Portal 上加 `container={container}`。以 `select.tsx` 的 `SelectContent` 为例，改完是这样（类名那一串保持 CLI 生成的原样）：

   ```tsx
   function SelectContent({
     className,
     children,
     position = "item-aligned",
     align = "center",
     container,
     ...props
   }: React.ComponentProps<typeof SelectPrimitive.Content> & {
     container?: HTMLElement
   }) {
     return (
       <SelectPrimitive.Portal container={container}>
         <SelectPrimitive.Content
           data-slot="select-content"
           className={cn(/* CLI 生成的类名，原样保留 */ className)}
           position={position}
           align={align}
           {...props}
         >
           <SelectScrollUpButton />
           <SelectPrimitive.Viewport className={cn(/* CLI 生成的类名，原样保留 */)}>
             {children}
           </SelectPrimitive.Viewport>
           <SelectScrollDownButton />
         </SelectPrimitive.Content>
       </SelectPrimitive.Portal>
     )
   }
   ```

   其余几个照同样三处改：`DropdownMenuContent`、`ContextMenuContent`、`PopoverContent`、`TooltipContent` 的 Portal 是
   `<XxxPrimitive.Portal>`；`DialogContent`、`AlertDialogContent` 包内容用的是同一文件里的 `DialogPortal`、`AlertDialogPortal`，
   `container` 加在它们上面，它们会把属性透传给 radix 的 Portal，遮罩层也跟着挂到同一处。
3. 从 `mountPane` 把 `args` 传下去，使用时指定挂载点：

   ```tsx
   <SelectContent container={args.shell.portal}>…</SelectContent>
   ```

**完成**：打开每一种浮层后切到另一张桌面，浮层随原桌面一起隐藏，切回来还在；`gwb.log` 里没有
「切到『…』时 body 上还挂着 N 个节点」这条 warn。

## 视觉验收

1. `devkit.dev {"home":"<home 名>","dir":"<仓根>","packages":["plugins/<短名>"]}` 把这一版装进隔离 home，回执 `ok: true`
   （样式检查在这一步跑，见「用令牌配颜色与布局」的完成判据）。
2. 用命令打开要验的窗格，不靠点状态栏菜单：
   - `devkit.cdp {"args":["<home 名>","cmd","shell.panes"]}`，在回执里找到本插件那一行，记下 `entryId` 与窗格 `id`
   - `devkit.cdp {"args":["<home 名>","cmd","shell.openPane","{\"entryId\":\"<entryId>\",\"paneId\":\"<窗格 id>\"}"]}`
     （工具窗格已开着就是把它激活）；已开着的某一份要激活，用 `shell.pane.list` 查它的 `instance`，再调 `shell.pane.focus {"instance":…}`

   一组里标签多到收进溢出菜单时，`click .dv-tab@=<标题>` 点不中被收起的那个标签：改用上面的命令打开或激活，
   或先用 `shell.pane.close` 关掉别的标签。
3. 用 `devkit.cdp` 在那个 home 里逐项操作并截图（先点窗格标签再截图、量颜色前关掉过渡，做法见
   `skill.read {"name":"gwb-devkit","file":"references/evidence.md"}`）：
   - 亮、暗两套主题（状态栏的亮暗按钮）
   - 拖动分隔条把窗格拉窄、拉宽，布局跟着窗格宽度变
   - 控件的 hover、focus、disabled、error 状态，以及只用键盘操作
   - 打开每一种浮层后切桌面
   - 关掉窗格再打开；文档窗格开两份，互不影响
4. 读 `gwb.log` 这次新增的部分。

**完成**：`devkit.dev` 回执 `ok: true`；每一项都有截图，截图里文字与背景对比清楚、控件都有样式、浮层只出现在
它所在的桌面上；`gwb.log` 新增部分没有 error，也没有「body 上还挂着」的 warn。

## 参考

`components.json`（`demo` 换成本插件前缀）：

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

样式入口 `src/client/styles.css` 的五行：

```css
@import 'tailwindcss/theme.css' theme(reference) prefix(demo);
@import '@godcreator/gwb-shell/theme.reference.css' theme(reference);
@import 'tailwindcss/utilities.css' layer(utilities) source(none);
@import 'tw-animate-css';
@source "./";
```

约定与容易出错的地方：

- 五行少了任何一行，对应的那批类都编不出规则，构建照样通过：少了映射文件，颜色类全空；少了 `tw-animate-css`，
  官方组件的 `animate-in` 一族全空
- 插件的样式表只含本插件的工具类与本插件前缀的变量；页面的令牌值、preflight 与层顺序由外壳加载
- 映射文件里没有的尺寸写任意值（`demo:w-[37px]`），产物里的 `var()` 保持没有字面 fallback
- CSS 前缀只含小写字母，`devkit.scaffold` 从插件短名去掉其他字符得到
- 样式入口必须是 `src/` 下唯一一个写了 `prefix(…)` 的 css（注释里的不算），而且只写这一处；再有一个 css 写了
  `prefix(…)`，样式检查认不出哪个是入口，直接算没过
- 样式检查从包目录 `node_modules` 里装的外壳读 `theme.reference.css` 里的颜色名：peer 里写了外壳却没在仓根
  `pnpm install`，也算没过
- 源码检查只扫样式入口所在目录（含子目录）下的 `.tsx`，而且扫的是**全部**字符串字面量，不只是 `className`：
  按空白切开后，任何一段只要跟工具类同名（`font-sans`、`hidden`、`flex` 这类），就被当成漏了前缀的类名报出来；
  以前缀加冒号开头、却编不出规则的字符串也报。不是类名的字符串（设置键名、命令参数）挪进 `.ts` 文件
- JSX 属性值也是字符串字面量，同样会被扫：`data-*`、`aria-*`、`placeholder`、`type`、`role` 的值跟工具类同名时
  （如 `type="hidden"`、`role="grid"`、`data-slot="table"`）照样报漏了前缀。自己起的值（`data-*` 这类）换个名字；
  换不了的（`type`、`role`）把值写成 `.ts` 文件里的常量，在 `.tsx` 里引用常量
- 反过来，`.ts` 文件、样式入口目录以外的文件、模板串 `${…}` 插值里拼出来的类名都不查，漏了前缀不报错，只是页面上那一处没样式；
  带前缀的 `group` / `peer` 标记类不编规则，也不在检查范围内，标记类和用它的变体要自己核对
- 插件的 `tailwindcss` 与外壳同一个大版本；升大版本时对照 `theme.reference.css` 的文件头注释重新核对键名
- 包根 tsconfig 缺 `paths` 时，shadcn CLI 把组件建进包根下一个名字就叫 `@` 的目录，只有 CLI 输出的文件路径看得出来
- 外部网页链接要在系统浏览器里打开，写 `<a href="https://…" target="_blank">` 或调 `window.open`（内核 0.6.2 起
  这两种的 http、https 地址交给系统默认浏览器）。不带 `target` 的普通 `<a href>` 点击是整个页面的跳转，内核一律拒绝，
  点了没有任何反应，只在 `gwb.log` 里多一行 warn
- `params` 必须能 JSON 序列化；`pluginKey`、`entryId`、`paneId`、`icon`、`key`、`preview` 是外壳的保留键，
  插件传了会被去掉并在页面控制台 warn
- `openPane`、`shell.openPane` 都不切桌面；命令回执 `ok` 表示已转交页面执行，结果用 `shell.pane.list` 查
- `mountPane` 用到的类型都从 `@godcreator/gwb-shell/pane` `import type`：`PaneArgs`、`PaneHandle`、`ShellBridge`、
  `HostBridge`，以及 `OpenPaneOptions`、`Placement`、`PaneKind`、`PaneContent`。这个子路径只有类型，按值 import 在构建时报错
- 页面上 `window.gwb` 的类型：`import type {} from '@godcreator/gwb-kernel-desktop'`（内核包的包根一加载就启动 Electron 应用，只能写 `import type`）

## 规矩

规矩总表读 `skill.read {"name":"gwb-devkit","file":"references/rules.md"}`，一条一行，写着每条由哪道检查负责。
