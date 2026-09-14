# gwb-theme

**定位**：外观——字体与自定义 CSS，全局启动样式；没外壳也照常挂。

## 提供

无服务——窗格与命令经总线直接面客（或门/皮就是产品）。

## 依赖

<!-- 来源 ../plugins/theme/src/index.ts:32-32 · 未确认 -->

```ts
export const inject = ['gwbSettings', 'gwbCommands']
```

`gwbCommands`（硬依赖，inject）、`gwbSettings`（硬依赖，inject）、`gwbShell`（局部注入）

## 命令

命令清单不存卡——**现扫 `/surface`**（`?plugin=gwb-theme` 取这一组的形状）。
