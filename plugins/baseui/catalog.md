# gwb-baseui

**定位**：基础插件的官方窗格集——目前两格：日志（logger）、插件管理（plugin-manager）。只收「劈过件的皮」，UI 即本体的插件不进。

## 提供

无服务——窗格与命令经总线直接面客（或门/皮就是产品）。

## 依赖

<!-- 来源 ../plugins/baseui/src/index.ts:32-32 · 新鲜 -->

```ts
export const inject = ['gwbShell']
```

`gwbShell`（硬依赖，inject）、`gwbLogger`（局部注入）、`gwbPluginManager`（局部注入）

## 命令

命令清单不存卡——**经门现扫**（MCP 门 `search`，`plugin` 用包名筛这一组）。
