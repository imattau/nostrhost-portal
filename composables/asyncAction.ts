// Shared boilerplate for the busy/clear/try/catch/finally shape repeated
// across the login, my-site and nostr-account pages: set a busy flag, clear
// the previous error/status, run an async action, report a failure message
// on error, and always clear busy (plus any extra per-site cleanup)
// afterwards.

export type StatusKind = 'success' | 'error' | 'warning'

export interface StatusValue {
  text: string
  kind: StatusKind
}

/**
 * A single `{ text, kind }` status ref plus a `setStatus` helper, used by
 * pages that surface one alert banner for the outcome of their async
 * actions (my-site, nostr-account).
 */
export function useStatus() {
  const status = ref<StatusValue | null>(null)

  function setStatus(text: string, kind: StatusKind = 'success') {
    status.value = { text, kind }
  }

  return { status, setStatus }
}

export interface AsyncActionOptions {
  /** Reset the previous error/status before the action starts. */
  clear: () => void
  /** Report a failure once the action throws. */
  onError: (error: any) => void
  /** Extra cleanup that should always run, in addition to clearing busy. */
  onFinally?: () => void
}

/**
 * Creates a `busy` ref and a `run` wrapper that executes an async action
 * with the shared busy/clear/try/catch/finally boilerplate. Multiple call
 * sites on the same page may share one instance (its `busy` flag then
 * covers all of them), or a page may create one instance per independent
 * busy flag.
 */
export function useAsyncAction() {
  const busy = ref(false)

  async function run(action: () => Promise<void>, options: AsyncActionOptions) {
    busy.value = true
    options.clear()
    try {
      await action()
    } catch (e: any) {
      options.onError(e)
    } finally {
      options.onFinally?.()
      busy.value = false
    }
  }

  return { busy, run }
}
