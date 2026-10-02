import { supabase } from '../lib/supabase'
import { AppError, toAppError } from '../lib/errors'
import { fetchProfile, getCurrentUserId } from './auth'

// AI operation costs (in kb_token). Shown in the UI and used for a pre-check;
// the authoritative price list is ai_operation_cost() in the database.
export const AI_COSTS = {
  generate_cards: 5,
  break_down_task: 3,
  board_analysis: 8,
  sprint_summary: 3,
  workflow_optimization: 10,
  dependency_analysis: 8,
  what_if_analysis: 6,
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
  findings: any[]
}

/**
 * Runs an AI operation for the authenticated user:
 *   1. verify the session
 *   2. check the kb_token balance
 *   3. execute the operation
 *   4. on success, charge via charge_ai_operation (deducts + writes receipt atomically)
 *   5. on failure, record a failed receipt and charge nothing
 * The result is only returned once the charge has been recorded.
 */
async function runAIOperation<T>(
  operation: AIOperation,
  workspaceId: string | null,
  metadata: Record<string, unknown>,
  execute: () => T | Promise<T>
): Promise<T> {
  const userId = await getCurrentUserId()
  const cost = AI_COSTS[operation]

  const profile = await fetchProfile(userId)
  if (profile.kb_token_balance < cost) {
    throw new AppError(`Not enough kb_token. This needs ${cost}, you have ${profile.kb_token_balance}.`, {
      code: 'insufficient_kb_tokens',
    })
  }

  let result: T
  try {
    result = await execute()
  } catch (err) {
    const { error: logError } = await supabase.rpc('log_failed_ai_operation', {
      p_operation: operation,
      p_workspace_id: workspaceId,
      p_metadata: metadata,
    })
    // Logged for debugging; the user sees the operation failure below.
    if (logError) toAppError(logError, 'Unable to record failed AI operation.')
    throw toAppError(err, 'The AI operation failed. No kb_token were charged.')
  }

  const { error } = await supabase.rpc('charge_ai_operation', {
    p_operation: operation,
    p_workspace_id: workspaceId,
    p_metadata: metadata,
  })
  if (error) throw toAppError(error, 'Your AI token balance could not be updated.')

  return result
}

// For now, we'll use simulated AI responses
// In production, this would call Hugging Face API
export function generateCardsFromObjective(objective: string, workspaceId: string): Promise<GeneratedCard[]> {
  return runAIOperation('generate_cards', workspaceId, { objective }, () => simulateCardGeneration(objective))
}

export function breakDownTask(cardTitle: string, cardDescription: string, workspaceId: string): Promise<GeneratedCard[]> {
  return runAIOperation('break_down_task', workspaceId, { cardTitle }, () =>
    simulateTaskBreakdown(cardTitle, cardDescription)
  )
}

export function analyzeBoard(boardData: any, workspaceId: string): Promise<AIAnalysisResult> {
  return runAIOperation('board_analysis', workspaceId, {}, () => ({
    operation: 'board_analysis',
    kb_token_cost: AI_COSTS.board_analysis,
    findings: simulateBoardAnalysis(boardData),
  }))
}

export function optimizeWorkflow(boardData: any, workspaceId: string): Promise<AIAnalysisResult> {
  return runAIOperation('workflow_optimization', workspaceId, {}, () => ({
    operation: 'workflow_optimization',
    kb_token_cost: AI_COSTS.workflow_optimization,
    findings: simulateWorkflowOptimization(boardData),
  }))
}

export function generateSprintSummary(sprintData: any, workspaceId: string): Promise<any> {
  return runAIOperation('sprint_summary', workspaceId, {}, () => simulateSprintSummary(sprintData))
}

// Simulated AI responses (to be replaced with Hugging Face API calls)
function simulateCardGeneration(objective: string): GeneratedCard[] {
  // Simple heuristic-based generation
  const tasks: GeneratedCard[] = []

  if (objective.toLowerCase().includes('landing page')) {
    tasks.push(
      { title: 'Define page structure', description: 'Outline the sections and layout', estimated_time: 60, priority: 'high', suggested_labels: ['planning'] },
      { title: 'Create hero section', description: 'Build the main hero area with headline', estimated_time: 120, priority: 'high', suggested_labels: ['frontend'] },
      { title: 'Implement feature section', description: 'Add features showcase area', estimated_time: 90, priority: 'medium', suggested_labels: ['frontend'] },
      { title: 'Add testimonials', description: 'Include customer testimonials section', estimated_time: 60, priority: 'medium', suggested_labels: ['content'] },
      { title: 'Add pricing section', description: 'Create pricing plans display', estimated_time: 90, priority: 'medium', suggested_labels: ['frontend'] },
      { title: 'Implement responsive layout', description: 'Ensure mobile responsiveness', estimated_time: 120, priority: 'high', suggested_labels: ['frontend', 'mobile'] },
      { title: 'Add SEO metadata', description: 'Optimize meta tags and descriptions', estimated_time: 30, priority: 'low', suggested_labels: ['seo'] },
      { title: 'Test mobile responsiveness', description: 'Test on various devices', estimated_time: 60, priority: 'medium', suggested_labels: ['testing'] }
    )
  } else {
    // Generic breakdown
    tasks.push(
      { title: 'Research requirements', description: 'Research and document requirements', estimated_time: 60, priority: 'high', suggested_labels: ['planning'] },
      { title: 'Create initial design', description: 'Draft initial design or approach', estimated_time: 90, priority: 'high', suggested_labels: ['design'] },
      { title: 'Implement core features', description: 'Build the main functionality', estimated_time: 180, priority: 'high', suggested_labels: ['implementation'] },
      { title: 'Testing and refinement', description: 'Test and refine the implementation', estimated_time: 120, priority: 'medium', suggested_labels: ['testing'] },
      { title: 'Documentation', description: 'Document the work done', estimated_time: 60, priority: 'low', suggested_labels: ['docs'] }
    )
  }

  return tasks
}

function simulateTaskBreakdown(title: string, _description: string): GeneratedCard[] {
  // Simple heuristic-based breakdown
  if (title.toLowerCase().includes('payment') || title.toLowerCase().includes('checkout')) {
    return [
      { title: 'Design database schema', description: 'Create payment-related tables', estimated_time: 60, priority: 'high', suggested_labels: ['backend', 'database'] },
      { title: 'Implement payment service', description: 'Create payment processing logic', estimated_time: 180, priority: 'high', suggested_labels: ['backend'] },
      { title: 'Provider integration', description: 'Integrate payment provider API', estimated_time: 120, priority: 'high', suggested_labels: ['backend', 'api'] },
      { title: 'Webhook handling', description: 'Handle payment webhooks', estimated_time: 90, priority: 'high', suggested_labels: ['backend'] },
      { title: 'Payment UI', description: 'Build checkout interface', estimated_time: 120, priority: 'medium', suggested_labels: ['frontend'] },
      { title: 'Error handling', description: 'Implement error scenarios', estimated_time: 60, priority: 'medium', suggested_labels: ['backend', 'frontend'] },
      { title: 'Testing', description: 'Test payment flows', estimated_time: 90, priority: 'high', suggested_labels: ['testing'] }
    ]
  }

  // Generic breakdown
  return [
    { title: 'Analysis and planning', description: 'Analyze requirements and plan approach', estimated_time: 60, priority: 'high', suggested_labels: ['planning'] },
    { title: 'Implementation phase 1', description: 'Initial implementation', estimated_time: 120, priority: 'high', suggested_labels: ['implementation'] },
    { title: 'Implementation phase 2', description: 'Complete implementation', estimated_time: 120, priority: 'high', suggested_labels: ['implementation'] },
    { title: 'Testing', description: 'Test the implementation', estimated_time: 60, priority: 'medium', suggested_labels: ['testing'] }
  ]
}

function simulateBoardAnalysis(boardData: any): any[] {
  const findings = []

  // Check for WIP limit violations
  if (boardData.columns) {
    for (const column of boardData.columns) {
      const cardCount = boardData.cardsByColumn[column.id]?.length || 0
      if (column.wip_limit && cardCount > column.wip_limit) {
        findings.push({
          type: 'wip_overflow',
          column: column.name,
          evidence: { wip: cardCount, limit: column.wip_limit },
          severity: 'high',
          recommendation: `Finish or move cards from ${column.name} before starting new work.`
        })
      }
    }
  }

  // Check for blocked cards
  if (boardData.cardsByColumn) {
    for (const columnId in boardData.cardsByColumn) {
      const blockedCards = boardData.cardsByColumn[columnId].filter((c: any) => c.blocked)
      if (blockedCards.length > 0) {
        findings.push({
          type: 'blocked_work',
          count: blockedCards.length,
          severity: 'medium',
          recommendation: 'Review and resolve blocked cards to improve flow.'
        })
      }
    }
  }

  return findings
}

function simulateWorkflowOptimization(boardData: any): any[] {
  const findings = []

  // Analyze WIP distribution
  if (boardData.columns && boardData.cardsByColumn) {
    const wipByColumn = boardData.columns.map((col: any) => ({
      name: col.name,
      count: boardData.cardsByColumn[col.id]?.length || 0,
      limit: col.wip_limit
    }))

    const developmentColumn = wipByColumn.find((c: any) => c.name.toLowerCase().includes('progress') || c.name.toLowerCase().includes('dev'))
    const reviewColumn = wipByColumn.find((c: any) => c.name.toLowerCase().includes('review'))

    if (developmentColumn && reviewColumn && developmentColumn.count > reviewColumn.count * 2) {
      findings.push({
        type: 'wip_imbalance',
        message: `${developmentColumn.name} has significantly more work than ${reviewColumn.name}`,
        recommendation: 'Complete existing development cards before pulling new work.',
        evidence: { development: developmentColumn.count, review: reviewColumn.count }
      })
    }
  }

  return findings
}

function simulateSprintSummary(sprintData: any): any {
  return {
    completed: sprintData.completed || 0,
    inProgress: sprintData.inProgress || 0,
    blocked: sprintData.blocked || 0,
    highlights: [],
    risks: [],
    nextFocus: []
  }
}
