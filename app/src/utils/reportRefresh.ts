export const REPORT_REFRESH_INTERVAL_MS = 10000

/** Coalesce background events; never keep invalidating a slow request with polling. */
export function subscribeReportRefresh(
  refresh: () => Promise<unknown>,
  browserWindow: Window = window,
  browserDocument: Document = document
): () => void {
  let stopped = false
  let running = false
  let queued = false
  const run = async () => {
    if (stopped || browserDocument.visibilityState === 'hidden') return
    if (running) { queued = true; return }
    running = true
    try {
      await refresh()
    } catch {
      // The page owns the visible error message and retains its last good snapshot.
    } finally {
      running = false
      if (!stopped && queued) { queued = false; void run() }
    }
  }
  const trigger = () => { void run() }
  const interval = browserWindow.setInterval(trigger, REPORT_REFRESH_INTERVAL_MS)
  browserWindow.addEventListener('focus', trigger)
  browserWindow.addEventListener('online', trigger)
  browserDocument.addEventListener('visibilitychange', trigger)
  return () => {
    stopped = true
    queued = false
    browserWindow.clearInterval(interval)
    browserWindow.removeEventListener('focus', trigger)
    browserWindow.removeEventListener('online', trigger)
    browserDocument.removeEventListener('visibilitychange', trigger)
  }
}
