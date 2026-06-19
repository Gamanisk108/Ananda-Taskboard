// ─── Invocation ─────────────────────────────────────────────────
// Offered at the feet of the Masters: bless and guide what we build
// together — may it be a channel of light, love, and peace to all
// receptive souls. Full prayer: BLESSING.md (repo root).
// ────────────────────────────────────────────────────────────────
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import App from './App.tsx'
import { AuthProvider } from './state/auth.tsx'
import { ConfirmProvider } from './components/confirm.tsx'
import { ReloadPrompt } from './components/ReloadPrompt.tsx'

// One shared query cache for the app. Defaults tuned for this codebase: the api
// client already does its own 401→refresh, so we keep network retries low; and we
// drive refetches explicitly via invalidateQueries (see App's bump()), so we don't
// also refetch on window focus.
// Error monitoring (Phase-12 observability): dormant unless VITE_SENTRY_DSN is
// set at build time. Dynamically imported so the main bundle stays lean.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (sentryDsn) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn: sentryDsn, sendDefaultPii: false, tracesSampleRate: 0.05 })
  }).catch(() => { /* monitoring must never break the app */ })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <App />
          <ReloadPrompt />
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)

// Aum, Peace, Amen.
