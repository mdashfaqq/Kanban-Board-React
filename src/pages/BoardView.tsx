import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getBoard, getBoardFullData, createCard, moveCard, deleteCard, type Board, type Card } from '../services/board'
import { analyzeBoard, optimizeWorkflow, generateCardsFromObjective } from '../services/ai'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toaster'
import type { User } from '../services/auth'
import { Button } from '../components/ui/button'
import { Sidebar } from '../components/AppLayout'
import { Input } from '../components/ui/input'
import { ArrowLeft, Plus, MoreVertical, Trash2, Clock, AlertCircle, BarChart3, Sparkles, X, Target, Loader2 } from 'lucide-react'
import AICommandCenter from '../components/AICommandCenter'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import SmartCardGenerator from '../components/SmartCardGenerator'

interface BoardViewProps {
  user: User
}

export default function BoardView({ user }: BoardViewProps) {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { refreshProfile } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<any[]>([])
  const [cardsByColumn, setCardsByColumn] = useState<Record<string, Card[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ columnId: string; index: number } | null>(null)
  const [showAICommand, setShowAICommand] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showSmartGenerator, setShowSmartGenerator] = useState(false)

  useEffect(() => {
    if (boardId) {
      loadBoard()
    }
  }, [boardId])

  async function loadBoard() {
    setLoadError(null)
    try {
      const [boardRow, data] = await Promise.all([getBoard(boardId!), getBoardFullData(boardId!)])
      setBoard(boardRow)
      setColumns(data.columns)
      setCardsByColumn(data.cardsByColumn)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load board.'))
    } finally {
      setLoading(false)
    }
  }

  /** Returns true on success so the form only clears once the card is saved. */
  async function handleAddCard(columnId: string, title: string): Promise<boolean> {
    try {
      const card = await createCard(columnId, title)
      setCardsByColumn((prev) => ({
        ...prev,
        [columnId]: [...(prev[columnId] || []), card],
      }))
      return true
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save card. Please try again.'))
      return false
    }
  }

  async function handleMoveCard(cardId: string, toColumnId: string, toIndex: number) {
    try {
      await moveCard(cardId, toColumnId, toIndex)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to move card.'))
    }
    // Reload either way so the board reflects what is actually stored.
    await loadBoard()
  }

  async function handleDeleteCard(cardId: string, columnId: string) {
    try {
      await deleteCard(cardId)
      setCardsByColumn((prev) => ({
        ...prev,
        [columnId]: prev[columnId].filter((c) => c.id !== cardId),
      }))
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete card.'))
    }
  }

  function onDragStart(e: React.DragEvent, cardId: string) {
    e.dataTransfer.setData('text/plain', cardId)
    setDragging(cardId)
  }

  function onDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    const cardEls = Array.from(e.currentTarget.querySelectorAll('[data-card]'))
    const idx = cardEls.findIndex((el) => {
      const box = el.getBoundingClientRect()
      return e.clientY < box.top + box.height / 2
    })
    setDropTarget({ columnId, index: idx === -1 ? cardEls.length : idx })
  }

  function onDrop(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    const cardId = e.dataTransfer.getData('text/plain') || dragging
    if (cardId && dropTarget) {
      handleMoveCard(cardId, columnId, dropTarget.index)
    }
    setDropTarget(null)
    setDragging(null)
  }

  /** Runs an AI call, then refreshes the kb_token balance whether or not it succeeded. */
  async function withBalanceRefresh<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } finally {
      refreshProfile().catch((err) => toast.error(getErrorMessage(err, 'Unable to refresh your kb_token balance.')))
    }
  }

  async function handleAICommand(command: string, _params?: any) {
    const boardData = { columns, cardsByColumn }
    if (command === 'analyze') {
      return withBalanceRefresh(() => analyzeBoard(boardData, board!.workspace_id))
    }
    if (command === 'optimize') {
      return withBalanceRefresh(() => optimizeWorkflow(boardData, board!.workspace_id))
    }
    return { message: 'Command not implemented yet' }
  }

  async function handleGenerateCards(objective: string) {
    return withBalanceRefresh(() => generateCardsFromObjective(objective, board!.workspace_id))
  }

  async function handleCreateGeneratedCards(cards: any[]) {
    const firstColumn = columns[0]
    if (!firstColumn) throw new Error('No columns available')

    try {
      for (const card of cards) {
        await createCard(firstColumn.id, card.title, card.description, card.priority as any)
      }
      toast.success(`${cards.length} card${cards.length === 1 ? '' : 's'} created.`)
    } finally {
      // Show whatever was actually saved, even if a later insert failed.
      await loadBoard()
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading board…
      </div>
    )
  }

  if (loadError || !board) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center p-6">
        <AlertCircle className="h-6 w-6 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{loadError ?? 'Unable to load board.'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>Back to workspaces</Button>
          <Button onClick={() => { setLoading(true); loadBoard() }}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar user={user} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-border bg-background/40 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {board?.name}
              </h1>
              <p className="text-sm text-muted-foreground">{board?.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSmartGenerator(!showSmartGenerator)}
              className={showSmartGenerator ? 'bg-accent border-primary/40 text-foreground' : ''}
            >
              <Target className="h-4 w-4 mr-2" />
              Generate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAICommand(!showAICommand)}
              className={showAICommand ? 'bg-accent border-primary/40 text-foreground' : ''}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={showAnalytics ? 'bg-accent border-primary/40 text-foreground' : ''}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Smart Card Generator Panel */}
          {showSmartGenerator && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Smart Card Generation</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowSmartGenerator(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SmartCardGenerator
                onGenerate={handleGenerateCards}
                onCreateCards={handleCreateGeneratedCards}
                kbTokenBalance={user.kb_token_balance}
                cost={5}
              />
            </div>
          )}

          {/* AI Command Center Panel */}
          {showAICommand && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">AI Command Center</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAICommand(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <AICommandCenter onCommand={handleAICommand} kbTokenBalance={user.kb_token_balance} />
            </div>
          )}

          {/* Analytics Dashboard Panel */}
          {showAnalytics && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Analytics Dashboard</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAnalytics(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <AnalyticsDashboard
                metrics={{
                  wip: Object.values(cardsByColumn).flat().length,
                  cycleTime: 3.5,
                  throughput: 5,
                  blockedCards: Object.values(cardsByColumn).flat().filter((c) => c.blocked).length,
                  staleCards: 0,
                  flowEfficiency: 78,
                  wipViolations: columns.filter((c) => c.wip_limit && (cardsByColumn[c.id]?.length || 0) > c.wip_limit).length,
                }}
              />
            </div>
          )}

          {/* Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => {
              return (
                <div
                  key={column.id}
                  className="glass flex-shrink-0 w-80 rounded-2xl p-3"
                  onDragOver={(e) => onDragOver(e, column.id)}
                  onDrop={(e) => onDrop(e, column.id)}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{column.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {cardsByColumn[column.id]?.length || 0}
                        </span>
                        {column.wip_limit && (
                          <>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-sm text-muted-foreground">{column.wip_limit}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3 min-h-[200px]">
                    {(cardsByColumn[column.id] || []).map((card, index) => (
                      <div key={card.id}>
                        {dropTarget?.columnId === column.id && dropTarget?.index === index && (
                          <div className="h-1 bg-primary rounded mb-2" />
                        )}
                        <div
                          data-card
                          draggable
                          onDragStart={(e) => onDragStart(e, card.id)}
                          className={`bg-card/80 rounded-xl p-4 shadow-notion cursor-grab transition-colors duration-200 border border-border hover:border-primary/40 ${
                            dragging === card.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-sm text-foreground flex-1">{card.title}</h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteCard(card.id, column.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {card.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{card.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {card.priority && (
                              <span
                                className={`px-2 py-0.5 rounded-md font-medium capitalize ${
                                  card.priority === 'high'
                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    : card.priority === 'medium'
                                    ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                                    : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                {card.priority}
                              </span>
                            )}
                            {card.blocked && (
                              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                <AlertCircle className="h-3 w-3" />
                                Blocked
                              </span>
                            )}
                            {card.estimated_time_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {card.estimated_time_minutes}m
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {dropTarget?.columnId === column.id &&
                      dropTarget?.index === (cardsByColumn[column.id]?.length || 0) && (
                        <div className="h-1 bg-primary rounded mb-2" />
                  )}
                  </div>

                  <AddCardForm columnId={column.id} onAdd={handleAddCard} />
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

function AddCardForm({ columnId, onAdd }: { columnId: string; onAdd: (columnId: string, title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    const saved = await onAdd(columnId, title.trim())
    setSaving(false)
    // On failure keep the typed title so the user can retry.
    if (saved) {
      setTitle('')
      setShowForm(false)
    }
  }

  if (!showForm) {
    return (
      <Button
        variant="ghost"
        className="w-full text-left text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        onClick={() => setShowForm(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add a card
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter card title..."
        autoFocus
        onBlur={() => !title && setShowForm(false)}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
