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
