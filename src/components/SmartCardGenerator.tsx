import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Sparkles, Plus, X, Check } from 'lucide-react'

interface GeneratedCard {
  title: string
  description: string
  estimated_time: number
  priority: 'low' | 'medium' | 'high'
  suggested_labels: string[]
  dependencies?: string[]
}

interface SmartCardGeneratorProps {
  onGenerate: (objective: string) => Promise<GeneratedCard[]>
  onCreateCards: (cards: GeneratedCard[]) => Promise<void>
  kbTokenBalance: number
  cost: number
}

export default function SmartCardGenerator({
  onGenerate,
  onCreateCards,
  kbTokenBalance,
  cost,
}: SmartCardGeneratorProps) {
  const [objective, setObjective] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([])
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!objective.trim()) return

    setError(null)
    setIsGenerating(true)

    try {
      const cards = await onGenerate(objective)
      setGeneratedCards(cards)
      setSelectedCards(new Set(cards.map((_, i) => i)))
    } catch (err: any) {
      setError(err.message || 'Failed to generate cards')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCreateSelected() {
    if (selectedCards.size === 0) return

    setIsCreating(true)
    try {
      const cardsToCreate = generatedCards.filter((_, i) => selectedCards.has(i))
      await onCreateCards(cardsToCreate)
      setGeneratedCards([])
      setSelectedCards(new Set())
      setObjective('')
    } catch (err: any) {
      setError(err.message || 'Failed to create cards')
    } finally {
      setIsCreating(false)
    }
  }

  function toggleCardSelection(index: number) {
    const newSelected = new Set(selectedCards)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedCards(newSelected)
  }

  function toggleAll() {
    if (selectedCards.size === generatedCards.length) {
      setSelectedCards(new Set())
    } else {
      setSelectedCards(new Set(generatedCards.map((_, i) => i)))
    }
  }

  if (generatedCards.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Card Generation
          </CardTitle>
          <CardDescription>
            Describe what you're building, and AI will break it down into actionable cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-3">
            <Input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g., 'Build a landing page' or 'Implement user authentication'"
              disabled={isGenerating || kbTokenBalance < cost}
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Cost: {cost} kb_token | Balance: {kbTokenBalance}
              </div>
              <Button
                type="submit"
                disabled={isGenerating || !objective.trim() || kbTokenBalance < cost}
              >
                {isGenerating ? 'Generating...' : 'Generate Cards'}
              </Button>
            </div>
            {error && (
              <div className="text-sm text-red-600 mt-2">{error}</div>
            )}
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generated Cards
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setGeneratedCards([])}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Review and select the cards you want to create
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedCards.size === generatedCards.length ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-sm text-gray-500">
              {selectedCards.size} of {generatedCards.length} selected
            </span>
          </div>

          {generatedCards.map((card, index) => (
            <div
              key={index}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedCards.has(index)
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => toggleCardSelection(index)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                    selectedCards.has(index)
                      ? 'bg-primary border-primary'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedCards.has(index) && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{card.title}</div>
                  {card.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {card.description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        card.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : card.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {card.priority}
                    </span>
                    <span className="text-xs text-gray-500">{card.estimated_time}m</span>
                    {card.suggested_labels.map((label) => (
                      <span key={label} className="text-xs text-primary">
                        #{label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleCreateSelected}
              disabled={isCreating || selectedCards.size === 0}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : `Create ${selectedCards.size} Cards`}
            </Button>
            <Button variant="outline" onClick={() => setGeneratedCards([])}>
              Cancel
            </Button>
          </div>

          {error && (
            <div className="text-sm text-red-600 mt-2">{error}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
