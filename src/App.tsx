import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2, AlertCircle, Layout } from 'lucide-react'
import { AuthProvider, useAuth, type AuthStatus } from './lib/auth'
import { ToastProvider } from './components/Toaster'
import { Button } from './components/ui/button'
import Dashboard from './pages/Dashboard'
import Workspace from './pages/Workspace'
import BoardView from './pages/BoardView'
import AIUsage from './pages/AIUsage'
import Settings from './pages/Settings'

const STATUS_LABELS: Record<Exclude<AuthStatus, 'ready' | 'error'>, string> = {
  initializing: 'Initializing…',
  signing_in: 'Signing in…',
  loading_profile: 'Loading your profile…',
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6">{children}</div>
}

/** Renders the app only once a Supabase session and profile are ready. */
function AuthGate() {
  const { status, user, error, retry } = useAuth()

  if (status === 'error') {
    return (
      <FullScreen>
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Authentication failed</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={retry}>Try again</Button>
        </div>
      </FullScreen>
    )
  }

  if (status !== 'ready' || !user) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
            <Layout className="h-5 w-5 text-background" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === 'ready' ? STATUS_LABELS.loading_profile : STATUS_LABELS[status]}
          </div>
        </div>
      </FullScreen>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard user={user} />} />
      <Route path="/workspace/:workspaceId" element={<Workspace user={user} />} />
      <Route path="/board/:boardId" element={<BoardView user={user} />} />
      <Route path="/ai-usage" element={<AIUsage user={user} />} />
      <Route path="/settings" element={<Settings user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen text-foreground">
            <AuthGate />
          </div>
        </Router>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
