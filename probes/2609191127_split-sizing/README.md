# 新建一组时怎么只切基准组一半

## 问什么

dockview 8.3.1 里要「把基准组对半分出新的一组、别的组宽高一个像素不变」，`addPanel` 带参照不给尺寸、给 `initialWidth`、先开成标签再 `moveTo` 三条路各牵动谁；基准组在一列里时要不要补、怎么补。

## 怎么跑

```powershell
node "$env:APPDATA\gwb-kernel\homes\default\node_modules\@godcreator\gwb-devkit\bin\cdp.mjs" <隔离 home 名> eval (Resolve-Path rows.js).Path
```

先决条件：一个装了 shell 与 baseui（`home:baseui` 的 `plugin-manager` 窗格）的**隔离 home**（`devkit.home.new` 起的，别打 default），
切到一张不要紧的桌面——脚本会清空当前桌面再搭布局，跑完清空。脚本经 React fiber 从外壳 App 的第一个 `useState` 取 dockview api，
认的是 App 的 props 里有 `initialDoc` 与 `specs`，外壳改了 App 的形状要跟着改。

四个脚本、四份输出（`runs/`，devkit.cdp 的原样回执）：

| 脚本 | 量什么 |
| --- | --- |
| `rows.js` | 三组一排 495 / 295 / 265：三条路切中间那组、切最右那组；一列里的情形；`index` 插入位置 |
| `row-float-and-base-sameh.js` | 同上取浮点宽高；一列里分完把基准组高设回原高（无效） |
| `column-sibling-setsize.js` | 一列里分完把变了的兄弟组 `setSize` 回原值（方向不对：设 314 落成 310，三叠时流到别的兄弟） |
| `column-base-fix.js` | 一列里分完把基准组高设成 `2×原高−现高`：二叠上下、三叠上中下、竖根、一排最右，量兄弟偏差 |

## 结论

- 带参照、不给尺寸：四组全部均分（261 左右）
- `initialWidth` = 基准组半宽：基准组在中间时**不动**，最右那组 265 → 117；基准组在最右时才对（265 → 132 / 126）
- 先开成不激活标签再 `moveTo` 到右边：基准组 295 → 144 / 144，兄弟各 −0.67px（多一道 8px 缝、全排重新平摊，逻辑尺寸不变）
- 基准组在一列里（跨轴包分支）：两条路都让基准组 313 → 309、同列兄弟 314 → 318——`Gridview.addView` 包分支时拿叶子渲染后的高当逻辑尺寸；
  分完给基准组 `setSize({ height: 2×原高−现高 })` 补回，六种布局兄弟组宽高偏差全部不到 1px（`runs/04` 的 `afterFix` 全空）
- `addPanel` 带 `referenceGroup` + `index`：插在那个位置；不给 `index` 追加到末尾

外壳定了第三条路加包分支补偿（`plugins/shell/src/client/open.ts` 的 `splitOpen`、`openable.ts` 的 `splitHeightFix`）。

## 跑那次的环境

2026-09-19，Windows 11，gwb-kernel 0.9.0 安装版（Electron 页面视口 1086×683），dockview-core 8.3.1（经 dockview-react 8.2.0），
隔离 home `pane-v2-2609191124`，shell `0.9.3-dev.202609191142`（仓 commit `e72cc12`；前三份第一次跑时 home 里还是 shell 0.9.2，数字相同——量的是 dockview 本身）。
