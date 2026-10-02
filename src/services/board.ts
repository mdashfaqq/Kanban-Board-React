import { supabase } from '../lib/supabase'
import { AppError, toAppError } from '../lib/errors'
import { getCurrentUserId } from './auth'

export interface Board {
  id: string
  workspace_id: string
  name: string
  description: string | null
  template: string | null
  created_at: string
  updated_at: string
}

export interface Column {
  id: string
  board_id: string
  name: string
  order_index: number
  wip_limit: number | null
  color: string | null
  collapsed: boolean
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  column_id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'critical' | null
  assignee_id: string | null
  due_date: string | null
  estimated_time_minutes: number | null
  actual_time_minutes: number | null
  created_at: string
  updated_at: string
  start_date: string | null
  completion_date: string | null
  blocked: boolean
  blocker_reason: string | null
  order_index: number
}

export async function createBoard(
  workspaceId: string,
  name: string,
  description?: string,
  template?: string
): Promise<Board> {
  await getCurrentUserId()

  const { data: board, error } = await supabase
    .from('boards')
    .insert({
      workspace_id: workspaceId,
      name,
      description,
      template,
    })
    .select()
    .single()

  if (error) throw toAppError(error, 'Unable to create board.')

  // Create default columns based on template
  const columns = getDefaultColumns(template).map((column) => ({ board_id: board.id, ...column }))
  const { error: columnsError } = await supabase.from('columns').insert(columns)

  if (columnsError) {
    // Don't leave a board without columns behind.
    const { error: cleanupError } = await supabase.from('boards').delete().eq('id', board.id)
    // Logged for debugging; the user sees the columns error below.
    if (cleanupError) toAppError(cleanupError, 'Unable to clean up partially created board.')
    throw toAppError(columnsError, 'Unable to create board columns.')
  }

  return board as Board
}

function getDefaultColumns(template?: string): Omit<Column, 'id' | 'board_id' | 'created_at' | 'updated_at'>[] {
  if (template === 'personal') {
    return [
      { name: 'Inbox', order_index: 0, wip_limit: null, color: null, collapsed: false },
      { name: 'Today', order_index: 1, wip_limit: 5, color: null, collapsed: false },
      { name: 'In Progress', order_index: 2, wip_limit: 3, color: null, collapsed: false },
      { name: 'Done', order_index: 3, wip_limit: null, color: null, collapsed: false },
    ]
  }

  if (template === 'software') {
    return [
      { name: 'Backlog', order_index: 0, wip_limit: null, color: null, collapsed: false },
      { name: 'Todo', order_index: 1, wip_limit: null, color: null, collapsed: false },
      { name: 'Development', order_index: 2, wip_limit: 5, color: null, collapsed: false },
      { name: 'Review', order_index: 3, wip_limit: 3, color: null, collapsed: false },
      { name: 'Testing', order_index: 4, wip_limit: 3, color: null, collapsed: false },
      { name: 'Done', order_index: 5, wip_limit: null, color: null, collapsed: false },
    ]
  }

  if (template === 'marketing') {
    return [
      { name: 'Ideas', order_index: 0, wip_limit: null, color: null, collapsed: false },
      { name: 'Planning', order_index: 1, wip_limit: 5, color: null, collapsed: false },
      { name: 'Content', order_index: 2, wip_limit: 5, color: null, collapsed: false },
      { name: 'Review', order_index: 3, wip_limit: 3, color: null, collapsed: false },
      { name: 'Published', order_index: 4, wip_limit: null, color: null, collapsed: false },
    ]
  }

  // Default template
  return [
    { name: 'Backlog', order_index: 0, wip_limit: null, color: null, collapsed: false },
    { name: 'Todo', order_index: 1, wip_limit: null, color: null, collapsed: false },
    { name: 'In Progress', order_index: 2, wip_limit: 5, color: null, collapsed: false },
    { name: 'Review', order_index: 3, wip_limit: 3, color: null, collapsed: false },
    { name: 'Done', order_index: 4, wip_limit: null, color: null, collapsed: false },
  ]
}

export async function getWorkspaceBoards(workspaceId: string): Promise<Board[]> {
  await getCurrentUserId()

  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw toAppError(error, 'Unable to load boards.')
  return data as Board[]
}

export async function getBoard(boardId: string): Promise<Board> {
  await getCurrentUserId()

  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .maybeSingle()

  if (error) throw toAppError(error, 'Unable to load board.')
  if (!data) throw new AppError("This board doesn't exist or you don't have access to it.", { code: 'not_found' })
  return data as Board
}

export async function getBoardColumns(boardId: string): Promise<Column[]> {
  await getCurrentUserId()

  const { data, error } = await supabase
    .from('columns')
    .select('*')
    .eq('board_id', boardId)
    .order('order_index', { ascending: true })

  if (error) throw toAppError(error, 'Unable to load board columns.')
  return data as Column[]
}

export async function getBoardFullData(boardId: string) {
  const columns = await getBoardColumns(boardId)
  const cardsByColumn: Record<string, Card[]> = {}
  for (const column of columns) cardsByColumn[column.id] = []

  if (columns.length > 0) {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .in('column_id', columns.map((c) => c.id))
      .order('order_index', { ascending: true })

    if (error) throw toAppError(error, 'Unable to load cards.')
    for (const card of data as Card[]) cardsByColumn[card.column_id]?.push(card)
  }

  return { columns, cardsByColumn }
}

export async function createCard(
  columnId: string,
  title: string,
  description?: string,
  priority?: 'low' | 'medium' | 'high' | 'critical'
): Promise<Card> {
  await getCurrentUserId()

  // Get current max order_index
  const { data: existingCards, error: orderError } = await supabase
    .from('cards')
    .select('order_index')
    .eq('column_id', columnId)
    .order('order_index', { ascending: false })
    .limit(1)

  if (orderError) throw toAppError(orderError, 'Unable to save card.')

  const nextOrderIndex = existingCards && existingCards.length > 0 ? existingCards[0].order_index + 1 : 0

  // Activity is logged by the on_card_activity database trigger.
  const { data, error } = await supabase
    .from('cards')
    .insert({
      column_id: columnId,
      title,
      description,
      priority,
      order_index: nextOrderIndex,
    })
    .select()
    .single()

  if (error) throw toAppError(error, 'Unable to save card.')
  return data as Card
}

export async function updateCard(cardId: string, updates: Partial<Card>): Promise<Card> {
  await getCurrentUserId()

  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)
    .select()
    .maybeSingle()

  if (error) throw toAppError(error, 'Unable to save card.')
  if (!data) throw new AppError("This card doesn't exist or you don't have permission to edit it.", { code: 'not_found' })
  return data as Card
}

export async function moveCard(cardId: string, toColumnId: string, toOrderIndex: number): Promise<void> {
  await getCurrentUserId()

  const { data, error } = await supabase
    .from('cards')
    .update({ column_id: toColumnId, order_index: toOrderIndex })
    .eq('id', cardId)
    .select('id')

  if (error) throw toAppError(error, 'Unable to move card.')
  if (!data || data.length === 0) {
    throw new AppError("This card doesn't exist or you don't have permission to move it.", { code: 'not_found' })
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  await getCurrentUserId()

  const { data, error } = await supabase.from('cards').delete().eq('id', cardId).select('id')

  if (error) throw toAppError(error, 'Unable to delete card.')
  if (!data || data.length === 0) {
    throw new AppError("This card doesn't exist or you don't have permission to delete it.", { code: 'not_found' })
  }
}
