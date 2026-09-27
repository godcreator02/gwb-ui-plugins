# @godcreator/gwb-theme

## 是什么

gwb 工作台的外观插件：用户设的正文字体、等宽字体和一段自定义 CSS，在页面启动时作为全局样式表生效；
装了外壳时另有一个「外观」窗格用来改这三项。没装外壳也照常加载，启动样式照样生效，只是没有这个窗格。

装进一个 home：`plugin-manager.install {"pkg":"@godcreator/gwb-theme"}`。依赖设置插件 `@godcreator/gwb-settings`
存这三项。

## 怎么用

- **在界面上改**：从状态栏「新建」打开「外观」窗格。输入时页面上直接预览，保存后每次启动都生效；不保存就关掉窗格，
  退回已保存的样子
- **用命令改**：`theme.values` 读三项当前值，`theme.save {"font-sans":"…","font-mono":"…","custom-css":"…"}`
  一次写齐三项（三个键都必给，空串是恢复默认）；参数形状看 `search {"plugin":"@godcreator/gwb-theme"}`
- **写插件界面的人**：用 `font-sans`、`font-mono` 这两个工具类（带本插件前缀）的文字会跟着用户设的字体走，
  不需要依赖这个包
