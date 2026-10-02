import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { User } from '../services/auth'
import { getStoredTheme, applyTheme, type Theme } from '../lib/theme'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { Layout, Zap, Home, Settings, Moon, Sun } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/ai-usage', label: 'AI Usage', icon: Zap },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ user }: { user: User }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar/60 backdrop-blur-xl flex flex-col">
      {/* Logo */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
        <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center">
          <Layout className="h-4 w-4 text-background" />
        </div>
        <div className="leading-tight">
          <h1 className="font-semibold text-sm tracking-tight">FlowKanban</h1>
          <p className="text-xs text-muted-foreground">Plan less. Flow better.</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = pathname === path
          return (
            <Button
              key={path}
              variant="ghost"
              className={cn(
                'w-full h-9 justify-start text-left font-normal',
                active ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => navigate(path)}
            >
              <Icon className={cn('h-4 w-4 mr-3', active && 'text-primary')} />
              {label}
            </Button>
          )
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-2">
        <Button
          variant="ghost"
          className="w-full h-9 justify-start text-left font-normal text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 mr-3" /> : <Moon className="h-4 w-4 mr-3" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
      </div>

      {/* User Info */}
      <div className="p-3 border-t border-border">
        <div className="glass flex items-center gap-3 p-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
            <span className="text-xs font-semibold">
              {(user.full_name?.[0] || user.email?.[0] || 'G').toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.full_name || 'Guest'}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email ?? 'Anonymous session'}</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-border text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-medium text-foreground">{user.kb_token_balance}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

interface AppLayoutProps {
  user: User
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export default function AppLayout({ user, title, subtitle, actions, children }: AppLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col overflow-auto">
        <header className="h-16 shrink-0 border-b border-border bg-background/40 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between px-6">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>

        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  )
}
