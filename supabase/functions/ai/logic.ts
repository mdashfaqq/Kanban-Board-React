// Pure logic for the `ai` Edge Function: prompts, response parsing and
// validation. No Deno or network APIs here, so it can be unit-tested with vitest.

export type Operation =
  | 'generate_cards'
  | 'break_down_task'
  | 'board_analysis'
  | 'workflow_optimization'
  | 'dependency_analysis'
  | 'focus_recommendation'
  | 'sprint_summary'

export const OPERATIONS: readonly Operation[] = [
  'generate_cards',
  'break_down_task',
  'board_analysis',
  'workflow_optimization',
  'dependency_analysis',
  'focus_recommendation',
  'sprint_summary',
]

export function isOperation(value: unknown): value is Operation {
  return typeof value === 'string' && (OPERATIONS as readonly string[]).includes(value)
}

export interface BoardSnapshot {
  name: string
  columns: {
    name: string
    wip_limit: number | null
    cards: { title: string; priority: string | null; blocked: boolean; estimated_time_minutes: number | null }[]
  }[]
}

export interface GeneratedCard {
  title: string
  description: string
  estimated_time: number
  priority: 'low' | 'medium' | 'high'
  suggested_labels: string[]
}

export interface Finding {
  type: string
  recommendation: string
  evidence?: Record<string, unknown>
}

export interface CommandResult {
  operation: Operation
  findings: Finding[]
  message?: string
}

const MAX_INPUT_CHARS = 500
const MAX_CARDS_IN_PROMPT = 120

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** Compact, size-bounded text description of a board for the prompt. */
export function describeBoard(board: BoardSnapshot): string {
  let remaining = MAX_CARDS_IN_PROMPT
  const lines = [`Board: ${clip(board.name, 80)}`]
  for (const col of board.columns) {
    const limit = col.wip_limit ? ` (WIP limit ${col.wip_limit})` : ''
    lines.push(`\n## ${clip(col.name, 60)}${limit} — ${col.cards.length} card(s)`)
    for (const card of col.cards.slice(0, Math.max(remaining, 0))) {
      const tags = [
        card.priority ? `priority=${card.priority}` : null,
        card.blocked ? 'BLOCKED' : null,
        card.estimated_time_minutes ? `${card.estimated_time_minutes}m` : null,
      ].filter(Boolean)
      lines.push(`- ${clip(card.title, 120)}${tags.length ? ` [${tags.join(', ')}]` : ''}`)
    }
    remaining -= col.cards.length
  }
  if (remaining < 0) lines.push(`\n(${-remaining} more card(s) omitted)`)
  return lines.join('\n')
}

const SYSTEM =
  'You are FlowKanban, an expert Kanban and lean-flow coach. ' +
  'Respond with a single JSON object only — no markdown, no code fences, no commentary.'

const FINDINGS_SHAPE =
  '{"findings": [{"title": string (short headline), "recommendation": string (1-2 actionable sentences)}], "summary": string}'

/** Builds the chat messages for an operation. */
export function buildMessages(
  operation: Operation,
  board: BoardSnapshot,
  input: string | undefined
): { role: 'system' | 'user'; content: string }[] {
  const boardText = describeBoard(board)
  const userInput = input ? clip(input.trim(), MAX_INPUT_CHARS) : ''

  let task: string
  switch (operation) {
    case 'generate_cards':
      task =
        `Break this objective into 4-8 concrete Kanban cards.\nObjective: "${userInput}"\n\n` +
        'Return {"cards": [{"title": string (max 80 chars), "description": string (1 sentence), ' +
        '"estimated_time": integer minutes between 15 and 480, "priority": "low" | "medium" | "high", ' +
        '"suggested_labels": string[] (1-3 lowercase words)}]}. ' +
        'Avoid duplicating cards that already exist on the board.'
      break
    case 'break_down_task':
      task =
        (userInput
          ? `Break down this task into 3-7 smaller subtasks: "${userInput}".`
          : 'Pick the largest or riskiest in-progress card on the board and break it into 3-7 smaller subtasks.') +
        ` Each subtask is a finding whose title is the subtask and recommendation explains it. Return ${FINDINGS_SHAPE}.`
      break
    case 'board_analysis':
      task = `Find bottlenecks, WIP-limit violations, blocked work and flow risks on this board. Return 2-6 findings: ${FINDINGS_SHAPE}.`
      break
    case 'workflow_optimization':
      task = `Recommend 2-6 concrete changes to improve flow (WIP limits, column structure, pull policies, swarming). Return ${FINDINGS_SHAPE}.`
      break
    case 'dependency_analysis':
      task = `Identify likely dependencies and ordering risks between the cards (which must finish before others). Return 2-6 findings: ${FINDINGS_SHAPE}.`
      break
    case 'focus_recommendation':
      task = `Recommend the 1-3 cards to focus on next and why (finish before starting, unblock others, priority). Return ${FINDINGS_SHAPE}.`
      break
    case 'sprint_summary':
      task = `Write a short sprint status summary: what is done, in progress, blocked, plus top risks and next focus. Return ${FINDINGS_SHAPE}.`
      break
  }

  const extra = userInput && operation !== 'generate_cards' && operation !== 'break_down_task'
    ? `\n\nThe user also asked: "${userInput}"`
    : ''

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `${boardText}\n\n---\n${task}${extra}` },
  ]
}

/** Extracts the first JSON object from model output (tolerates code fences / chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Model response contained no JSON object')
  return JSON.parse(candidate.slice(start, end + 1))
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? clip(value.trim(), max) : ''
}

export function normalizeCards(data: unknown): GeneratedCard[] {
  const raw = (data as { cards?: unknown })?.cards
  if (!Array.isArray(raw)) throw new Error('Model response is missing "cards"')

  const cards = raw
    .map((c: any): GeneratedCard | null => {
      const title = str(c?.title, 120)
      if (!title) return null
      const minutes = Math.round(Number(c?.estimated_time))
      const priority = ['low', 'medium', 'high'].includes(c?.priority) ? c.priority : 'medium'
      const labels = Array.isArray(c?.suggested_labels)
        ? c.suggested_labels.map((l: unknown) => str(l, 24).toLowerCase()).filter(Boolean).slice(0, 3)
        : []
      return {
        title,
        description: str(c?.description, 300),
        estimated_time: Number.isFinite(minutes) ? Math.min(Math.max(minutes, 15), 480) : 60,
        priority,
        suggested_labels: labels,
      }
    })
    .filter((c): c is GeneratedCard => c !== null)
    .slice(0, 10)

  if (cards.length === 0) throw new Error('Model returned no usable cards')
  return cards
}

export function normalizeFindings(operation: Operation, data: unknown): CommandResult {
  const raw = (data as { findings?: unknown })?.findings
  if (!Array.isArray(raw)) throw new Error('Model response is missing "findings"')

  const findings = raw
    .map((f: any): Finding | null => {
      const type = str(f?.title ?? f?.type, 120)
      const recommendation = str(f?.recommendation ?? f?.detail, 600)
      return type || recommendation ? { type: type || 'Insight', recommendation } : null
    })
    .filter((f): f is Finding => f !== null)
    .slice(0, 8)

  const summary = str((data as { summary?: unknown })?.summary, 600)
  if (findings.length === 0 && !summary) throw new Error('Model returned no usable findings')
  return { operation, findings, message: summary || undefined }
}
