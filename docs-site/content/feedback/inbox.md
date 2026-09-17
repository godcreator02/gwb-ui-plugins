---
title: 收件箱
description: 别的仓投来的意见——一节一条，处理完删
---

# 收件箱

纯 md 一节一条：谁（哪个仓 / 哪个会话）、何时、关于什么、现象与复现路径。处理完删掉那一节。

## 2026-09-13 总控台会话：首开后的自动落盘没发生（隔离 home 上连续三个开机）

来源：总控台会话（验「新建桌面出生为空」时撞见，shell 0.4.4 与 0.4.5-dev 都在）。

现象：`devkit.home.new` 起的隔离 home（窗口从不进前台），开机铺完默认窗格之后，
**防抖落盘从未发生**——`data/shell/layout.json` 不存在，`gwb.log` 里 `shell.layout.save`
只有「登记上了」没有一次执行。直到切桌面 / 新建桌面触发**同步 flush** 才第一次落盘。
同一时段零报错，状态栏也没有「布局没存上」（说明 promise 没走到失败分支，更像定时器
根本没醒）。

两个怀疑，未判别：

1. occluded 窗口的计时器节流——devkit 起 home 带了 `--disable-backgrounding-occluded-windows`，
   但那面挡的是渲染判隐藏，`setTimeout` 节流是否也被挡没查过
2. `onWellReady` 里订阅 `onDidLayoutChange` 排在 `openDefaults` **之后**——若 dockview 在
   `addPanel` 里同步发事件，铺默认那三下全发生在订阅存在之前，一个都收不到

复现：起一个隔离 home → 什么都不动 → 读 `<home>/data/shell/layout.json`（没有）。
default home 平时看不见这条，因为人一交互（开/关/拖格）就有活订阅里的事件，照常落盘。

判别实验也现成：往 `onWellReady` 里订阅之后手动 `api.addPanel` 一次看 `scheduleSave`
醒不醒——醒则是怀疑 2，不醒则是怀疑 1。

## 2026-09-17 总控台会话：窗格容器的 data-gwb-plugin 取自布局存档，包改名后一直是旧名

来源：总控台会话（修 default 里「单元」格整片失样时查出来的；unit-folder 那头已在 0.6.0 改用类名前缀，
不再依赖这个属性，所以这边不急）。

现象：`PluginPane` 挂的 `data-gwb-plugin={pluginKey}`，`pluginKey` 来自 dockview 面板 params，也就是
布局存档里存下的那份，不是现场查注册表。default 的 `shell.layout.get` 里，换 scope 之前开的格全都还是
`@godcreator02/gwb-*`（单元、日志、站内预览、站监控、外观、插件源），而 `entryId` 没变、格照样挂得上。
于是属性上的「身份」对不上现在的包名，谁也不报错。

影响：前缀方案下属性「只是身份标记」，样式不受影响；但注释里说它是给探针、样式调试「认件的把手」，
这个把手在老存档上指错了件。另外 `saved` 里那套叫「88」的布局引的 plugins / hello / status 是早没了的件。

建议（未判，供参考）：挂载时用 `fetchPaneModule` 回来的现场包名覆盖 params 里那份；或读存档时按
`entryId` 把 `pluginKey` 刷成当前值，顺手在下次落盘时写回。

复现：`shell.layout.get` 看任何一个换 scope 之前开过的格的 `params.pluginKey`。

## 2026-09-17 总控台会话：标签图标表只认八个名字，认不出一律画 #，件猜错没有任何报错

来源：总控台中转站 `feedback/gwb-ui-plugins-26091700-标签图标表缺layout-grid.md`（隔离 home
`bn-collapse-2609161207` 里 `gwb-bn-query` 登记 `icon: 'layout-grid'`），体检会话补了规模。

现象：`plugins/shell/src/client/GwbTab.tsx` 的 `ICONS` 只有 scroll-text / store / puzzle /
flask-conical / panel-left / folder-open / file-text / folders 八枚，别的名字静默画 `Hash`。
default 此刻 `shell.panes` 里 receipt / eye / activity / palette / gauge / layout-grid 六个都画成 #；
`PaneSpec.icon` 的类型注释写的却是「lucide 的图标名（kebab-case）」。

期望：件不用猜——要么按 kebab 名从 lucide 全集取，要么封闭集合但认不出就出声、说明书写明认哪些。

## 2026-09-17 内核仓 feedback（devkit 投，总控台转）：没装 theme 的 home 每次开机一条「跑了条不存在的命令：theme.startupCss」

来源：`gwb-kernel` 站 feedback 区 inbox 第二节（09-15 devkit 投），总控台体检会话转来。

现象：`devkit.home.new` 的底座七件没有 theme，每个隔离 home 开机 `gwb.log` 都有一条
`gwb-commands 跑了条不存在的命令：theme.startupCss`；出厂种子要加 baseui（依旧不带 theme），
新用户首启也会撞上。第一次见的人会去追一个不存在的病。

源头：外壳浏览器半开机无条件 `host.call('theme.startupCss')`（`theme-boot.ts`），theme 是可选件。
