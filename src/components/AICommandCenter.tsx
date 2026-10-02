import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Sparkles, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface AICommandCenterProps {
  onCommand: (command: string, params?: any) => Promise<any>
  kbTokenBalance: number
}

export default function AICommandCenter({ onCommand, kbTokenBalance }: AICommandCenterProps) {
  const [command, setCommand] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const commands = [
    { id: 'breakdown', label: 'Break down this task', cost: 3, description: 'Break down a large task into smaller subtasks' },
    { id: 'analyze', label: 'Analyze board', cost: 8, description: 'Analyze board for bottlenecks and issues' },
    { id: 'optimize', label: 'Optimize workflow', cost: 10, description: 'Get workflow optimization recommendations' },
    { id: 'dependencies', label: 'Find dependencies', cost: 8, description: 'Analyze task dependencies' },
    { id: 'focus', label: 'What should I focus on?', cost: 5, description: 'Get AI-recommended focus tasks' },
    { id: 'summary', label: 'Generate sprint summary', cost: 3, description: 'Generate a sprint summary' },
  ]

  async function handleQuickCommand(cmdId: string) {
    setError(null)
    setResult(null)
    setIsProcessing(true)

    try {
      const response = await onCommand(cmdId)
      setResult(response)
    } catch (err: any) {
      setError(err.message || 'Command failed')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleNaturalCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim()) return

    setError(null)
    setResult(null)
    setIsProcessing(true)

    try {
      // Parse natural language command
      const lowerCmd = command.toLowerCase()
      let cmdId = 'analyze'

      if (lowerCmd.includes('break down') || lowerCmd.includes('breakdown')) {
        cmdId = 'breakdown'
      } else if (lowerCmd.includes('optimize') || lowerCmd.includes('workflow')) {
        cmdId = 'optimize'
      } else if (lowerCmd.includes('dependen')) {
        cmdId = 'dependencies'
      } else if (lowerCmd.includes('focus') || lowerCmd.includes('what should')) {
        cmdId = 'focus'
      } else if (lowerCmd.includes('summary') || lowerCmd.includes('sprint')) {
        cmdId = 'summary'
      }

      const response = await onCommand(cmdId, { naturalLanguage: command })
      setResult(response)
      setCommand('')
    } catch (err: any) {
      setError(err.message || 'Command failed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Natural Language Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Command Center
          </CardTitle>
          <CardDescription>
            Ask AI to analyze your board, break down tasks, or optimize your workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNaturalCommand} className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="e.g., 'Break down this task' or 'Why is the board slow?'"
                disabled={isProcessing}
              />
              <Button type="submit" disabled={isProcessing || !command.trim()}>
                {isProcessing ? 'Processing...' : 'Send'}
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              Current balance: {kbTokenBalance} kb_token
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Quick Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {commands.map((cmd) => (
              <Button
                key={cmd.id}
                variant="outline"
                className="justify-start text-left h-auto py-3 px-4"
                onClick={() => handleQuickCommand(cmd.id)}
                disabled={isProcessing || kbTokenBalance < cmd.cost}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{cmd.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{cmd.description}</div>
                </div>
                <div className="text-xs font-medium text-primary">
                  {cmd.cost} kb_token
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Command Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.findings && result.findings.length > 0 ? (
                result.findings.map((finding: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="font-medium text-sm">{finding.type || finding.message}</div>
                    {finding.recommendation && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {finding.recommendation}
                      </div>
                    )}
                    {finding.evidence && (
                      <div className="text-xs text-gray-500 mt-1">
                        Evidence: {JSON.stringify(finding.evidence)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {result.message || 'Command completed successfully'}
                </div>
              )}
              {result.kb_token_cost && (
                <div className="text-xs text-gray-500 mt-2">
                  kb_token used: -{result.kb_token_cost}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Insufficient Balance Warning */}
      {kbTokenBalance < 3 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Low kb_token Balance</span>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
              You have {kbTokenBalance} kb_token remaining. Some AI commands may not be available.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
