import type { LogPage } from './receipts'

export interface LogPollerOptions {
  /** `after` 为 undefined 时取最近的一批，否则只取那之后新写的；失败时 reject */
  fetchPage(after: number | undefined): Promise<LogPage>
  onPage(page: LogPage): void
  onFailure(reason: string): void
  intervalMs: number
}

export interface LogPoller {
  setVisible(visible: boolean): void
  stop(): void
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 启动时取一次；之后只在可见时每隔 `intervalMs` 带上次的 cursor 取一次，切回可见时立刻取。
 * 同一时刻最多一个请求：上一次回来之后才排下一次，命令慢时不会越积越多。
 * 失败时 cursor 不动、照常排下一次，所以启动那次失败后下一次仍是不带 `after` 的整批
 */
export function startLogPoller(options: LogPollerOptions): LogPoller {
  let cursor: number | undefined
  let visible = false
  let requestInFlight = false
  let stopped = false
  let pendingTimer: ReturnType<typeof setTimeout> | undefined

  const scheduleNext = (): void => {
    pendingTimer = setTimeout(() => {
      pendingTimer = undefined
      pull()
    }, options.intervalMs)
  }

  const settle = (): void => {
    requestInFlight = false
    if (!stopped && visible) scheduleNext()
  }

  const pull = (): void => {
    requestInFlight = true
    options.fetchPage(cursor).then(
      (page) => {
        if (stopped) return
        cursor = page.cursor
        options.onPage(page)
        settle()
      },
      (error: unknown) => {
        if (stopped) return
        options.onFailure(reasonOf(error))
        settle()
      },
    )
  }

  pull()

  return {
    setVisible(nextVisible) {
      visible = nextVisible
      if (!visible) {
        clearTimeout(pendingTimer)
        pendingTimer = undefined
        return
      }
      if (!requestInFlight && pendingTimer === undefined && !stopped) pull()
    },
    stop() {
      stopped = true
      clearTimeout(pendingTimer)
      pendingTimer = undefined
    },
  }
}
