import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AppError, toAppError } from '../lib/errors'
import { getCurrentUserId } from './auth'

// AI operation costs (in kb_token), shown in the UI. The authoritative price
// list is ai_operation_cost() in the database.
export const AI_COSTS = {
  generate_cards: 5,
  break_down_task: 3,
  board_analysis: 8,
  sprint_summary: 3,
  workflow_optimization: 10,
  dependency_analysis: 8,
  focus_recommendation: 5,
}

export type AIOperation = keyof typeof AI_COSTS

export interface GeneratedCard {
  title: string
  description: string
  estimated_time: number
  priority: 'low' | 'medium' | 'high'
  suggested_labels: string[]
  dependencies?: string[]
}

export interface AIAnalysisResult {
  operation: string
  kb_token_cost: number
  findings: { type: string; recommendation: string; evidence?: Record<string, unknown> }[]
  message?: string
}

/** AI Command Center button ids → operations. */
const COMMAND_OPERATIONS: Record<string, AIOperation> = {
  breakdown: 'break_down_task',
  analyze: 'board_analysis',
  optimize: 'workflow_optimization',
  dependencies: 'dependency_analysis',
  focus: 'focus_recommendation',
  summary: 'sprint_summary',
}

/**
 * Runs an AI operation in the `ai` Edge Function, which calls Hugging Face
 * server-side and charges kb_token only after the model succeeds.
 */
async function invokeAI<T>(operation: AIOperation, boardId: string, input?: string): Promise<{ result: T; cost: number }> {
  await getCurrentUserId()

  const { data, error } = await supabase.functions.invoke('ai', {
    body: { operation, board_id: boardId, input },
  })

  if (error) {
    // The function returns { error, code } with a user-facing message.
    if (error instanceof FunctionsHttpError) {
      let body: { error?: string; code?: string } = {}
      try {
        body = await error.context.json()
      } catch (parseError) {
        console.error('[AI] Could not parse error response', parseError)
      }
      console.error(`[AI] ${operation} failed:`, error.context.status, body)
      throw new AppError(body.error ?? 'The AI operation failed. Please try again.', { code: body.code, cause: error })
    }
    throw toAppError(error, 'Unable to reach the AI service. Please try again.')
  }

  return { result: data.result as T, cost: data.kb_token_cost ?? AI_COSTS[operation] }
}

export async function generateCardsFromObjective(objective: string, boardId: string): Promise<GeneratedCard[]> {
  const { result } = await invokeAI<GeneratedCard[]>('generate_cards', boardId, objective)
  return result
}

/** Runs an AI Command Center command (e.g. 'analyze') against a board. */
export async function runBoardCommand(command: string, boardId: string, input?: string): Promise<AIAnalysisResult> {
  const operation = COMMAND_OPERATIONS[command]
  if (!operation) throw new AppError('This AI command is not available.')

  const { result, cost } = await invokeAI<Omit<AIAnalysisResult, 'kb_token_cost'>>(operation, boardId, input)
  return { ...result, kb_token_cost: cost }
}
