import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { HostBridge, PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import { buildStartupCss } from '../startup-css.js'

/**
 * 浏览器侧：「外观」窗格。两个字体输入框加一块 CSS 文本域。
 * **输入后当场预览**（直接改页面上的启动样式表，外壳启动时建的那张），点保存才写到磁盘
 * （`theme.save`），重启后由外壳启动时恢复。**关窗格时丢弃没保存的预览**：dispose 时退回已保存的
 * 样子——否则页面上显示的样子重启后就没了，却没有任何提示。
 *
 * **这个文件里每一个类名都带 `theme:` 前缀**（Tailwind 的 prefix，见 `src/client/styles.css`）。
 * 本插件样式表里的规则只匹配这种类名：规则全页有效，但只可能匹配到本插件画出来的元素——隔离来自
 * 类名唯一，不靠 DOM 祖先关系。漏加前缀的类**不生成任何规则、构建照样通过**，所以由
 * `tests/prefix.test.ts` 检查。
 *
 * **样式表不由这里注入**：外壳的 PluginPane 在 import 这份 client.js 之前就注入了 style.css；令牌表
 * 是页面级的一份，也由外壳注入。容器上的 `data-gwb-plugin` 对这个插件**只是身份标记**，样式隔离靠类名前缀。
 *
 * 跟本插件的业务功能分开：用户填的自定义 CSS 经 `theme.startupCss` 注入成页面级的
 * `#gwb-theme-style`，作用于整页；这份编译产物只是这个窗格自己的工具类样式表。
 */

const VALUES_COMMAND = 'theme.values'
const SAVE_COMMAND = 'theme.save'

/** 页面上启动样式表的 id，与外壳 client 里的同一个字符串一致——两边各写一份，不互相 import */
const STYLE_ID = 'gwb-theme-style'

interface ValuesReply {
  'font-sans'?: unknown
  'font-mono'?: unknown
  'custom-css'?: unknown
}

/** 把一段 css 写进页面上的启动样式表，没有就新建；按 id 查找，调多少次页面上也只有一张 */
function applyToPage(css: string): void {
  let el = document.getElementById(STYLE_ID)
  if (el === null) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

const FIELD =
  'theme:w-full theme:rounded-md theme:border theme:border-input theme:bg-transparent theme:px-2 theme:py-1 theme:text-sm theme:outline-none theme:focus-visible:border-ring'

function Appearance({ host }: { host: HostBridge }): ReactElement {
  const [fontSans, setFontSans] = useState('')
  const [fontMono, setFontMono] = useState('')
  const [customCss, setCustomCss] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  /** 已保存的设置对应的整段 css。null 表示还没取到，这时既不预览也不退回 */
  const savedRef = useRef<string | null>(null)

  // 打开窗格时取一次当前值。取到之前不改页面上的启动样式表：预览会用空值覆盖它，
  // 外壳启动时注入的样式就会闪一下消失
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const reply = (await host.call(VALUES_COMMAND)) as { ok?: boolean; data?: unknown; error?: string }
        if (!alive) return
        if (reply.ok !== true || typeof reply.data !== 'object' || reply.data === null) {
          setNotice(`取现值没取到：${reply.error ?? JSON.stringify(reply)}`)
          return
        }
        const v = reply.data as ValuesReply
        const next = {
          fontSans: typeof v['font-sans'] === 'string' ? v['font-sans'] : '',
          fontMono: typeof v['font-mono'] === 'string' ? v['font-mono'] : '',
          customCss: typeof v['custom-css'] === 'string' ? v['custom-css'] : '',
        }
        setFontSans(next.fontSans)
        setFontMono(next.fontMono)
        setCustomCss(next.customCss)
        const css = buildStartupCss(next)
        savedRef.current = css
        applyToPage(css)
        setLoaded(true)
      } catch (err) {
        if (alive) setNotice(`取现值调不通：${String(err)}`)
      }
    })()
    return () => {
      alive = false
    }
  }, [host])

  // 任何一个输入框变了就当场预览；取到当前值之前不预览，理由同上
  const preview = buildStartupCss({ fontSans, fontMono, customCss })
  useEffect(() => {
    if (loaded) applyToPage(preview)
  }, [preview, loaded])

  // 关窗格时退回已保存的样子，没保存的预览不留在页面上
  useEffect(
    () => () => {
      if (savedRef.current !== null) applyToPage(savedRef.current)
    },
    [],
  )

  const save = async (): Promise<void> => {
    setNotice('存着…')
    try {
      const reply = (await host.call(SAVE_COMMAND, {
        'font-sans': fontSans,
        'font-mono': fontMono,
        'custom-css': customCss,
      })) as { ok?: boolean; error?: string }
      if (reply.ok !== true) {
        setNotice(`没存上：${reply.error ?? JSON.stringify(reply)}`)
        return
      }
      savedRef.current = buildStartupCss({ fontSans, fontMono, customCss })
      setNotice('存好了——重启也照这个来')
    } catch (err) {
      setNotice(`没存上：${String(err)}`)
    }
  }

  return (
    <div className="theme:flex theme:h-full theme:flex-col theme:gap-3 theme:overflow-auto theme:p-4 theme:text-sm">
      <p className="theme:m-0 theme:text-muted-foreground">
        改完当场生效，要重启后也照旧就点保存。字体填 font-family 的值（如{' '}
        <code className="theme:font-mono">Consolas, monospace</code>），留空用默认系统栈。
      </p>
      <label className="theme:flex theme:flex-col theme:gap-1">
        <span className="theme:text-muted-foreground">正文字体</span>
        <input
          className={FIELD}
          value={fontSans}
          onChange={(e) => setFontSans(e.target.value)}
          placeholder="留空 = 默认"
        />
      </label>
      <label className="theme:flex theme:flex-col theme:gap-1">
        <span className="theme:text-muted-foreground">等宽字体</span>
        <input
          className={FIELD}
          value={fontMono}
          onChange={(e) => setFontMono(e.target.value)}
          placeholder="留空 = 默认"
        />
      </label>
      <label className="theme:flex theme:min-h-40 theme:flex-1 theme:flex-col theme:gap-1">
        <span className="theme:text-muted-foreground">自定义样式表（整段 CSS，写在令牌之上）</span>
        <textarea
          className={`${FIELD} theme:min-h-40 theme:flex-1 theme:resize-none theme:font-mono`}
          value={customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          spellCheck={false}
          placeholder={':root {\n  --background: oklch(0.25 0.01 286);\n}'}
        />
      </label>
      <div className="theme:flex theme:items-center theme:gap-3">
        <button
          type="button"
          className="theme:rounded-md theme:border theme:border-input theme:bg-primary theme:px-3 theme:py-1 theme:text-primary-foreground"
          onClick={() => void save()}
        >
          保存
        </button>
        {notice === '' ? undefined : <span className="theme:text-muted-foreground">{notice}</span>}
      </div>
    </div>
  )
}

/** 外壳调的入口，参数与返回值的类型从外壳的子路径 `@godcreator/gwb-shell/pane` 引 */
export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const reactRoot: Root = createRoot(container)
  reactRoot.render(<Appearance host={args.host} />)
  return {
    dispose() {
      // 退回已保存的样子在组件卸载时的清理函数里做，这里只卸载 React 树
      reactRoot.unmount()
    },
  }
}
