/** electron 的 `BrowserWindow` 满足它 */
export interface ReloadableWindow {
  webContents: { reload(): void }
}

/** 测试里没有 electron，传一份假的进来 */
export interface ReloadDeps {
  windows(): ReloadableWindow[]
}

export interface ReloadResult {
  ok: boolean
  /** 成功时：重载了几个窗口 */
  reloaded?: number
  error?: string
}

/** 没有窗口回 `ok: false`：回成功的话调用方以为界面刷新了，其实什么都没发生 */
export function reloadWindows(deps: ReloadDeps): ReloadResult {
  const openWindows = deps.windows()
  if (openWindows.length === 0) {
    return { ok: false, error: '没有开着的窗口，没什么可重载的（窗口关了，或者不在 Electron 主进程里）' }
  }
  for (const browserWindow of openWindows) browserWindow.webContents.reload()
  return { ok: true, reloaded: openWindows.length }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * `BrowserWindow` 是类，`typeof` 是 `'function'`，所以对象或函数都继续往下取。
 * electron 是 CJS 包，命名空间与 `default` 上都有 API，先看 `default`；认不出就抛，调用方转成回执
 */
export function windowsOf(mod: unknown): ReloadDeps {
  const electronApi = isRecord(mod) && isRecord(mod['default']) ? mod['default'] : mod
  const browserWindowClass: unknown = isRecord(electronApi) ? electronApi['BrowserWindow'] : undefined
  const getAllWindows: unknown =
    typeof browserWindowClass === 'function' || isRecord(browserWindowClass) ? (browserWindowClass as Record<string, unknown>)['getAllWindows'] : undefined
  if (typeof getAllWindows !== 'function') {
    throw new Error(
      `import("electron") 里 BrowserWindow ${browserWindowClass === undefined ? '不在' : '在，但没有 getAllWindows'}——不在 Electron 主进程里，或者 electron 的接口变了`,
    )
  }
  return { windows: () => (getAllWindows as () => ReloadableWindow[])() }
}

/** 说明符放在变量里，不让 tsc 解析 `electron`（本包不装它的类型）；不在 Electron 里就 reject，调用方转成回执 */
export async function electronWindows(): Promise<ReloadDeps> {
  const electronSpecifier = 'electron'
  return windowsOf(await import(electronSpecifier))
}
