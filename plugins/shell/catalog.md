# gwb-shell

**定位**：外壳——窗格井、桌面、布局落盘、整页重载；内核页面根的唯一入口，UI 平台的整体（要换整套换）。

## 提供

`gwbShell`：`registerPane({ id, title, icon?, client, style })` 注册窗格（client/style 是浏览器半与样式表的 file:// 地址）/ describeSelf 报名字；0.1.1 起件那一格是容器查询根

## 依赖

<!-- 来源 ../plugins/shell/src/index.ts:87-87 · 新鲜 -->

```ts
  static inject = ['gwbCommands', 'gwbData']
```

`gwbCommands`（硬依赖，inject）、`gwbData`（硬依赖，inject）

## 命令

命令清单不存卡——**经门现扫**（MCP 门 `search`，`plugin` 用包名筛这一组）。
