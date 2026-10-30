import { Component, type ErrorInfo, type ReactNode } from 'react'
import { trackEvent } from '../lib/analytics'

// Catches an error while a part of the app renders, so one broken page shows
// a way out (components/ErrorScreen.tsx) instead of taking the whole screen
// blank. `resetKey` clears the error when it changes: the frame passes the
// address, so moving to another page tries again.
interface Props {
  children: ReactNode
  fallback: (error: Error) => ReactNode
  resetKey?: string
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app]', error, info.componentStack)
    // With consent, so errors visitors meet show up in analytics.
    trackEvent('app_error', {
      page_path: window.location.pathname,
      message: String(error?.message ?? error).slice(0, 100),
    })
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children
  }
}
