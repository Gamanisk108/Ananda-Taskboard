import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import App from './App.tsx'
import { AuthProvider } from './state/auth.tsx'
import { ConfirmProvider } from './components/confirm.tsx'

// One shared query cache for the app. Defaults tuned for this codebase: the api
// client already does its own 401→refresh, so we keep network retries low; and we
// drive refetches explicitly via invalidateQueries (see App's bump()), so we don't
// also refetch on window focus.
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
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
