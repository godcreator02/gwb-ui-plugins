# @godcreator/gwb-baseui

## 是什么

gwb 基础插件的官方窗格集：日志插件与插件管理本身没有界面，它们的窗格由这个插件提供。

| 窗格 | 什么时候有 | 做什么 |
| --- | --- | --- |
| 日志 | 总是有 | 看 `gwb.log` 里最近的日志，窗格可见时每秒取新写的；日志文件在哪 |
| 插件管理 | 装了 `@godcreator/gwb-plugin-manager` | 装、卸、升级、启停插件，改各插件的设置 |

没装插件管理就不登记插件管理窗格，其余照常。日志窗格按命令名调日志插件 `@godcreator/gwb-logger` 的 `logger.query`，
没装日志插件时窗格照样有，里面显示命令调用失败的原因。

## 怎么用

装进一个 home：`plugin-manager.install {"pkg":"@godcreator/gwb-baseui"}`，它需要外壳 `@godcreator/gwb-shell`。
装好后从状态栏「新建」打开这两个窗格；agent 侧核对 `shell.panes` 的回执里有 `logger` 与 `plugin-manager` 两个窗格。

只收基础插件的官方界面：自带界面的功能插件自己登记窗格，不进这个包。
