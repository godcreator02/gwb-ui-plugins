/**
 * `bootShell` 的参数由内核渲染层拼出，按形状声明、不引内核的类型。
 * `HostBridge` / `ShellBridge` / `PaneHandle` / `PaneArgs` 经子路径 `@godcreator/gwb-shell/pane` 导出，改它们就是改外壳对插件的接口
 */

import type { OpenPaneOptions, PaneKind } from '../openable.js'
import type { PaneContent } from '../panels.js'
import type { Versions } from '../protocol.js'

/**
 * 调一条命令：页面 → IPC → 主进程里命令总线的 `run(command, args, { via: 'ui' })`，resolve 的就是命令总线的回执。
 *
 * - 处理函数返回普通值：回执是 `{ ok: true, data: <返回值> }`
 * - 处理函数自己返回了带 `ok` 键的对象：原样交回。约定是 `{ ok: true, data? }` 或 `{ ok: false, error }`，
 *   也可能带别的键（外壳的转发类命令回 `{ ok: true, relayed: true }`），这时不一定有 `data`
 * - 命令不存在：`{ ok: false, error: '没有这条命令：<命令名>' }`
 * - 处理函数抛错或 reject：`{ ok: false, error: <错误转成的字符串> }`
 * - 没装命令插件：`{ ok: false, error }`，说明没有命令服务
 *
 * 所以命令本身的失败都是 resolve 成 `ok: false` 的回执，不会 reject；调用方先判 `ok === true` 再读 `data`。
 * `args` 与回执经 IPC 按结构化克隆复制，`args` 里有函数这类复制不了的值时，调用本身抛错或 reject。
 * 返回类型写成 `unknown`：回执的形状由各命令决定，读之前自己收窄
 */
export interface HostBridge {
  call(command: string, args?: unknown): Promise<unknown>
}

/** 入口模块（boot.ts）调 `bootShell` 时给的那几样，全从 `shell.env` 那条命令来 */
export interface ShellArgs {
  host: HostBridge
  /** 这个 home 的目录，只在状态栏显示 */
  home: string
  /** 按顺序加载的样式表地址：令牌表、dockview 样式表、外壳自己的样式表 */
  styles: string[]
  /** 用户外观样式，在三张样式表之后注入。theme 插件没装或没设置就没有 */
  startupCss?: string
  /** 状态栏版本那一项显示的：内核、外壳、运行时 */
  versions: Versions
}

/** 注册表里一条经 `shell.panes` 命令传到浏览器侧之后的样子。跟 node 侧的 `RegisteredPane` 是同一个形状 */
export interface PaneRow {
  entryId: string
  pkg: string
  id: string
  title: string
  icon?: string
  /** 浏览器侧脚本与样式表的 `file://` 地址，插件注册时给出 */
  client?: string
  style?: string
  /** 工具窗格还是文档窗格（注册时不说就是 tool） */
  kind: PaneKind
}

/** 插件名表里一条（`shell.plugins`）。启动器按插件分组时拿它的名字当组名 */
export interface PluginRow {
  entryId: string
  pkg: string
  title: string
  icon?: string
}

/**
 * 外壳交给窗格插件的接口。插件只能操作**自己**的窗格——`entryId` 由 `PluginPane`
 * 创建这个对象时闭包绑定，插件给不出别人的。
 */
export interface ShellBridge {
  /**
   * 打开本插件的另一个窗格。**来源就是调它的这一份**：新窗格开在它旁边（`placement` 缺省按目标组
   * 规则，`'side'` 开到旁边）、开在它所在的那张桌面上，**从不切桌面**。**身份是
   * `options.key`**，按窗格类别查已开的：工具窗格查这张桌面的所有组，有同一 key 的就激活它，
   * 这张桌面没有、别的桌面上有就在那张桌面激活它（不切过去，状态栏提示）；文档窗格只查目标组。
   * 没找到才开新的一份（`preview: true` 时优先放进目标组的预览窗格）。认不出 paneId 什么都不做。
   *
   * `options.params` 用来**让开出来的几份彼此不同**：它原样传给那一份的
   * `mountPane`（`pane.params`），并且随布局保存、重启后还在，所以必须可 JSON 序列化。
   * 与外壳保留键（`pluginKey`、`entryId`、`paneId`、`icon`、`key`、`preview`）重名的键打开时摘掉，
   * console 里 warn 一句。
   */
  openPane(paneId: string, options?: OpenPaneOptions): void
  /**
   * 改**这个窗格**标签上的标题，转调 dockview 的 `setTitle`。初始标题由 `registerPane` 定，
   * 这里只管运行时改。在 `mountPane` 里或挂载后的 effect 里调都有效；标题随布局保存，整页重载、重启后保留。
   */
  setPaneTitle(title: string): void
  /**
   * **上报这个窗格此刻装的内容**：插件在窗格里原地换了内容（点链接跳转、后退前进）之后调它。
   * 外壳把这一份的 key 换成新的；给了 `params` 就整份替换插件那部分参数（去掉保留键）；给了
   * `title` 等于同时 `setPaneTitle`。**不调 `retarget`、不重新挂载**——内容已经由插件换好了。
   * 之后布局照常保存，整页重载回到上报的内容。预览窗格上报之后仍是预览窗格，转正由 `keepPane` 做。
   */
  setPaneContent(content: PaneContent): void
  /**
   * 把**这个窗格**留住：它不再是预览窗格，下一次 preview 打开不会替换它。
   *
   * 插件该在「人真的开始用这个窗格」的那一刻调它（开始编辑、改了什么），**不是挂载时就调**
   * ——挂载时就调等于这个插件没有预览窗格。已经是正式窗格时调它什么都不做，重复调不要紧。
   * 人**双击标签**是同一个动作。没有反方向：正式窗格变不回预览窗格。
   */
  keepPane(): void
  /** 窗格间的消息总线。按条目分组，同一条目的几个窗格（含同一窗格开的几份）收发同一组消息 */
  bus: {
    emit(type: string, detail?: unknown): void
    /** 注册一个监听函数，返回注销函数 */
    on(type: string, listener: (detail: unknown) => void): () => void
  }
  /**
   * 本窗格所在桌面的**浮层挂载点**：插件里 radix Portal 的 `container` 指向它。这样浮层的 DOM
   * 在这张桌面里，桌面切走时跟着一起隐藏——挂在 `body` 下的浮层不属于任何桌面，隐藏不了，
   * 会盖在别的桌面上。不在窗格容器里时它是 `document.body`，跟 radix 缺省效果相同，插件不必判空。
   */
  portal: HTMLElement
  /**
   * 本窗格所在桌面的可见性：切走收到 `false`、切回收到 `true`，**注册时先回调一次当前值**，
   * 返回注销函数。插件用它暂停订阅、渲染、媒体（切走后视频音频照样播放，DOM 副作用
   * 外壳停不了），外壳只通知不强制。不需要的插件不用调。
   */
  onVisibility(listener: (visible: boolean) => void): () => void
}

/**
 * 插件的 `mountPane` 返回的句柄。**`dispose` 必须有，`retarget` 可选**：
 *
 * - 给了 `retarget`：外壳换了这个窗格的 params 之后调它（**软换**），插件自己决定怎么换
 *   内容、保留哪些状态（滚动位置、前进后退、正在输入的文字）
 * - 没给：外壳**卸载后重新挂载**（硬换）。简单的插件不必为此写代码，代价是这个窗格的
 *   内部状态重新开始
 */
export interface PaneHandle {
  dispose(): void
  retarget?(params: Record<string, unknown>): void
}

/** 外壳调插件的 `mountPane` 时传入的参数 */
export interface PaneArgs {
  host: HostBridge
  shell: ShellBridge
  pane: {
    /** 这个窗格是本插件的哪个窗格（注册时给的那个 id） */
    id: string
    /** 这**一份**的唯一键（dockview 的 panel id）。开两份时两份的这个值不一样 */
    instance: string
    /** 外壳把这个窗格当哪一类挂载的（注册时给的 kind，没给就是 tool） */
    kind: PaneKind
    /**
     * 开这一份时插件自己传的参数（`openPane` 的 `options.params`），**不含外壳的
     * 保留键**——插件看不到 `entryId` 这类外壳内部的字段。
     *
     * **没传就没有这一项**，不是空对象。它随布局保存，所以重启之后这一份拿到的
     * 还是当初那份参数。
     *
     * **这是挂载那一刻的参数**。后来换了内容的话，新参数经 `retarget(params)` 传给插件
     * （插件没给 `retarget` 就是卸载后重新挂载，那时这里拿到的就是新参数）。
     */
    params?: Record<string, unknown>
  }
}
