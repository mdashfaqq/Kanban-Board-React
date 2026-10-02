import { supabase } from '../lib/supabase'
import { AppError, toAppError } from '../lib/errors'
import { getCurrentUserId } from './auth'

export interface Workspace {
  id: string
  name: string
  mode: 'personal' | 'team'
  owner_id: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
}

/**
 * Creates the workspace and the caller's owner membership atomically via the
 * create_workspace RPC. The owner is always the authenticated user (auth.uid()).
 */
export async function createWorkspace(name: string, mode: 'personal' | 'team'): Promise<Workspace> {
  await getCurrentUserId()

  const { data, error } = await supabase.rpc('create_workspace', { p_name: name, p_mode: mode })
  if (error) throw toAppError(error, 'Unable to create workspace.')

  const workspace = (Array.isArray(data) ? data[0] : data) as Workspace | null
  if (!workspace) throw new AppError('Unable to create workspace.')
  return workspace
}

export async function getUserWorkspaces(): Promise<Workspace[]> {
  const userId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspaces (*)')
    .eq('user_id', userId)

  if (error) throw toAppError(error, 'Unable to load workspaces.')

  return (data ?? [])
    .map((m: any) => m.workspaces as Workspace | null)
    .filter((w): w is Workspace => w !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  await getCurrentUserId()

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) throw toAppError(error, 'Unable to load workspace.')
  if (!data) throw new AppError("This workspace doesn't exist or you don't have access to it.", { code: 'not_found' })
  return data as Workspace
}

export async function getWorkspaceMembers(workspaceId: string) {
  await getCurrentUserId()

  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      *,
      users (id, email, full_name, avatar_url)
    `)
    .eq('workspace_id', workspaceId)

  if (error) throw toAppError(error, 'Unable to load workspace members.')
  return data
}
