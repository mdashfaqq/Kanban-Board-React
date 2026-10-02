import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getWorkspaceBoards, createBoard, type Board } from '../services/board'
import { getWorkspace, type Workspace as WorkspaceRow } from '../services/workspace'
import { getErrorMessage } from '../lib/errors'
import { useToast } from '../components/Toaster'
import type { User } from '../services/auth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { ArrowLeft, Plus, Layout, AlertCircle, Loader2 } from 'lucide-react'

interface WorkspaceProps {
  user: User
}

export default function Workspace({ user }: WorkspaceProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [workspace, setWorkspace] = useState<WorkspaceRow | null>(null)
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showCreateBoard, setShowCreateBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [newBoardTemplate, setNewBoardTemplate] = useState('default')

  useEffect(() => {
    if (workspaceId) loadWorkspace()
  }, [workspaceId])

  async function loadWorkspace() {
    setLoading(true)
    setLoadError(null)
    try {
      const [ws, boardList] = await Promise.all([getWorkspace(workspaceId!), getWorkspaceBoards(workspaceId!)])
      setWorkspace(ws)
      setBoards(boardList)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load workspace.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const board = await createBoard(workspaceId!, newBoardName, undefined, newBoardTemplate)
      setBoards([...boards, board])
      setShowCreateBoard(false)
      setNewBoardName('')
      toast.success(`Board "${board.name}" created.`)
      navigate(`/board/${board.id}`)
    } catch (error) {
      // Keep the dialog open with the user's input so they can retry.
      const message = getErrorMessage(error, 'Unable to create board.')
      setCreateError(message)
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
        <AlertCircle className="h-6 w-6 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>Back to workspaces</Button>
          <Button onClick={loadWorkspace}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{workspace?.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{workspace?.mode} workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">{user.email ?? 'Guest'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Boards</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your boards in this workspace</p>
          </div>
          <Button onClick={() => setShowCreateBoard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Board
          </Button>
        </div>

        {boards.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Layout className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No boards yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first board to get started</p>
              <Button onClick={() => setShowCreateBoard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Board
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards.map((board) => (
              <Card
                key={board.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                <CardHeader>
                  <CardTitle>{board.name}</CardTitle>
                  {board.description && (
                    <CardDescription>{board.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Created {new Date(board.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Board Modal */}
      {showCreateBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Board</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateBoard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Board Name
                  </label>
                  <Input
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="My Board"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template
                  </label>
                  <select
                    value={newBoardTemplate}
                    onChange={(e) => setNewBoardTemplate(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="default">Default (Kanban)</option>
                    <option value="personal">Personal Tasks</option>
                    <option value="software">Software Development</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>
                {createError && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setShowCreateBoard(false); setCreateError(null) }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Board
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
