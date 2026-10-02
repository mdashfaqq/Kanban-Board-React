import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toAppError, getErrorMessage } from '../lib/errors'
import type { User } from '../services/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import AppLayout from '../components/AppLayout'
import { Zap, TrendingUp, BarChart3, AlertCircle } from 'lucide-react'

interface AIUsageProps {
  user: User
}

export default function AIUsage({ user }: AIUsageProps) {
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    loadAIOperations()
  }, [])

  async function loadAIOperations() {
    setLoading(true)
    setLoadError(null)
    try {
      // RLS restricts ai_operations to the signed-in user's own rows.
      const { data, error } = await supabase
        .from('ai_operations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw toAppError(error, 'Unable to load AI usage history.')
      setOperations(data || [])
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load AI usage history.'))
    } finally {
      setLoading(false)
    }
  }

  const totalTokensUsed = operations.reduce((sum, op) => sum + op.kb_token_cost, 0)

  return (
    <AppLayout user={user} title="AI Usage">
      <div className="max-w-6xl">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{user.kb_token_balance}</div>
              <p className="text-xs text-muted-foreground">kb_token available</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Used</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTokensUsed}</div>
              <p className="text-xs text-muted-foreground">kb_token consumed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operations</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{operations.length}</div>
              <p className="text-xs text-muted-foreground">AI operations performed</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage History */}
        <Card>
          <CardHeader>
            <CardTitle>Usage History</CardTitle>
            <CardDescription>Recent AI operations and token consumption</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : loadError ? (
              <div className="text-center py-8">
                <AlertCircle className="h-5 w-5 text-destructive mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">{loadError}</p>
                <button onClick={loadAIOperations} className="text-sm text-primary hover:underline">Try again</button>
              </div>
            ) : operations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No AI operations yet. Start using AI features to see your usage here.
              </div>
            ) : (
              <div className="space-y-4">
                {operations.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between p-4 bg-muted/60 rounded-xl"
                  >
                    <div>
                      <div className="font-medium text-foreground capitalize">
                        {op.operation.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(op.created_at).toLocaleString()}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          op.result_status === 'success'
                            ? 'text-green-600'
                            : op.result_status === 'failed'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {op.result_status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">-{op.kb_token_cost}</div>
                      <div className="text-xs text-muted-foreground">kb_token</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
