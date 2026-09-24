import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { HostBridge, PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import { buildStartupCss } from '../startup-css.js'

/**
 * 「外观」窗格：输入后直接改页面上的启动样式表预览，点保存才写入（`theme.save`）；关窗格时退回已保存的样子，
 * 否则没保存的预览重启后就没了却没有提示。类名一律带 `theme:` 前缀，漏加不报错，由 `tests/prefix.test.ts` 检查
 */

const VALUES_COMMAND = 'theme.values'
const SAVE_COMMAND = 'theme.save'

/** 与外壳浏览器侧的同一个字符串，两边各写一份、不互相 import */
const STYLE_ID = 'gwb-theme-style'

interface ValuesReply {
  'font-sans'?: unknown
  'font-mono'?: unknown
  'custom-css'?: unknown
}

/** 按 id 查找，没有就新建，页面上始终只有一张 */
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

  // 取到当前值之前不改页面上的启动样式表：否则预览会用空值覆盖它，外壳注入的样式会闪一下消失
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

  // 任何一个输入框变了就预览；取到当前值之前不预览
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

/** 外壳调的入口 */
export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const reactRoot: Root = createRoot(container)
  reactRoot.render(<Appearance host={args.host} />)
  return {
    dispose() {
      // 退回已保存的样子在组件卸载时的清理函数里做
      reactRoot.unmount()
    },
  }
}
