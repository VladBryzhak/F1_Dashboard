// Runs `fn` once the page has loaded and the browser is idle (or after a
// short wait where requestIdleCallback is missing), so work the first paint
// doesn't need stays out of its way. Returns a function that cancels it.
export function afterLoadIdle(fn: () => void, timeout = 4000): () => void {
  let cancelled = false
  let idleId: number | undefined
  let timerId: number | undefined
  const run = () => !cancelled && fn()
  const whenIdle = () => {
    if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(run, { timeout })
    else timerId = window.setTimeout(run, 2000)
  }
  if (document.readyState === 'complete') whenIdle()
  else window.addEventListener('load', whenIdle, { once: true })
  return () => {
    cancelled = true
    window.removeEventListener('load', whenIdle)
    if (idleId != null) window.cancelIdleCallback(idleId)
    if (timerId != null) window.clearTimeout(timerId)
  }
}
