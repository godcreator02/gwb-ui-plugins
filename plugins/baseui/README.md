# @godcreator/gwb-baseui

## 是什么

gwb 基础插件的官方窗格集：内核写的日志与插件管理本身没有界面，它们的窗格由这个插件提供。

| 窗格 | 什么时候有 | 做什么 |
| --- | --- | --- |
| 日志 | 总是有 | 看 `gwb.log` 里最近的日志，窗格可见时每秒取新写的；日志文件在哪 |
| 插件管理 | 装了 `@godcreator/gwb-plugin-manager` | 装、卸、升级、启停插件，改各插件的设置 |

没装插件管理就不登记插件管理窗格，其余照常。

另登记一条命令 `logger.query`（只读）：查内核写的 `<home>/gwb.log`（含轮转出的 `gwb.log.1`），可按级别、logger 名、子串筛，
只取最近几条，或只取某个位置之后新写的。日志窗格与经 MCP 入口的 agent 都调它；参数与回执看这条命令的 `usage`。
有命令总线 `@godcreator/gwb-commands` 时才登记。

## 怎么用

装进一个 home：`plugin-manager.install {"pkg":"@godcreator/gwb-baseui"}`，它需要外壳 `@godcreator/gwb-shell`。
装好后从状态栏「新建」打开这两个窗格；agent 侧核对 `shell.panes` 的回执里有 `logger` 与 `plugin-manager` 两个窗格，
`logger.query {"limit":5}` 回最近五条日志。

只收基础插件的官方界面：自带界面的功能插件自己登记窗格，不进这个包。
