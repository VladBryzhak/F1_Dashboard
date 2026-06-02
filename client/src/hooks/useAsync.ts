import { useEffect, useState } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Runs `producer` whenever any value in `deps` changes, tracking loading and
 * error state. Ignores results from stale calls (e.g. fast season switches).
 */
export function useAsync<T>(
  producer: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, loading: true, error: null }))
    producer()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (active)
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Request failed',
          })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
