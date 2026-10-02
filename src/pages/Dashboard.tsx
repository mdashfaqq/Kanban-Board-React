import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserWorkspaces, createWorkspace, type Workspace } from '../services/workspace'
import { getErrorMessage } from '../lib/errors'
import { useToast } from '../components/Toaster'
import type { User } from '../services/auth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Plus, Layout, Users, Search, AlertCircle, Loader2 } from 'lucide-react'
import AppLayout from '../components/AppLayout'

interface DashboardProps {
  user: User
}

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceMode, setNewWorkspaceMode] = useState<'personal' | 'team'>('personal')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadWorkspaces()
  }, [])

  async function loadWorkspaces() {
    setLoading(true)
    setLoadError(null)
    try {
      setWorkspaces(await getUserWorkspaces())
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load workspaces.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const workspace = await createWorkspace(newWorkspaceName, newWorkspaceMode)
      setWorkspaces([...workspaces, workspace])
      setShowCreateWorkspace(false)
      setNewWorkspaceName('')
      toast.success(`Workspace "${workspace.name}" created.`)
      navigate(`/workspace/${workspace.id}`)
    } catch (error) {
      // Keep the dialog open with the user's input so they can retry.
      const message = getErrorMessage(error, 'Unable to create workspace.')
      setCreateError(message)
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const filteredWorkspaces = workspaces.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppLayout
      user={user}
      title="Your Workspaces"
      subtitle={`${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`}
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 h-9"
            />
          </div>
          <Button onClick={() => setShowCreateWorkspace(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Workspace
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspaces…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="h-6 w-6 text-destructive mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
          <Button variant="outline" onClick={loadWorkspaces}>Try again</Button>
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-14 h-14 rounded-xl border border-border bg-card flex items-center justify-center mb-6">
            <Layout className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            No workspaces yet
          </h3>
          <p className="text-muted-foreground mb-6">Create your first workspace to get started</p>
          <Button onClick={() => setShowCreateWorkspace(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Workspace
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkspaces.map((workspace) => {
            return (
              <Card
                key={workspace.id}
                className="cursor-pointer transition-colors duration-200 hover:border-primary/40 hover:bg-accent/40"
                onClick={() => navigate(`/workspace/${workspace.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg border border-border bg-secondary flex items-center justify-center">
                      {workspace.mode === 'personal' ? (
                        <Layout className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="px-2 py-0.5 rounded-md border border-border text-xs text-muted-foreground capitalize">
                      {workspace.mode}
                    </div>
                  </div>
                  <CardTitle className="mt-3 text-base">{workspace.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(workspace.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-card/80 backdrop-blur-2xl">
            <CardHeader>
              <CardTitle>
                Create New Workspace
              </CardTitle>
              <CardDescription>Set up a new workspace for your projects</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Workspace Name</label>
                  <Input
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="My Workspace"
                    required
                    
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewWorkspaceMode('personal')}
                      className={`p-4 rounded-lg border transition-colors ${
                        newWorkspaceMode === 'personal'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <Layout className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-sm font-medium">Personal</div>
                      <div className="text-xs text-muted-foreground mt-1">For individual productivity</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewWorkspaceMode('team')}
                      className={`p-4 rounded-lg border transition-colors ${
                        newWorkspaceMode === 'team'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-sm font-medium">Team</div>
                      <div className="text-xs text-muted-foreground mt-1">For collaborative projects</div>
                    </button>
                  </div>
                </div>
                {createError && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </p>
                )}
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => { setShowCreateWorkspace(false); setCreateError(null) }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Workspace
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  )
}
