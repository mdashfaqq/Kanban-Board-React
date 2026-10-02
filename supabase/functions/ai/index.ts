// Supabase Edge Function: runs FlowKanban AI operations on Hugging Face.
//
// Flow: verify user → load board through RLS → check balance → call the model
//       → on success charge_ai_operation (atomic deduct + receipt)
//       → on failure log_failed_ai_operation (no charge).
//
// Secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
//   HF_TOKEN  required  Hugging Face token with "Inference Providers" permission
//   HF_MODEL  optional  defaults to meta-llama/Llama-3.1-8B-Instruct
// SUPABASE_URL / SUPABASE_ANON_KEY are provided by Supabase automatically.
//
// The function runs with the caller's JWT, never the service-role key, so every
// read and the token charge are authorized by RLS / auth.uid().

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  buildMessages,
  extractJson,
  isOperation,
  normalizeCards,
  normalizeFindings,
  type BoardSnapshot,
  type Operation,
} from './logic.ts'

const HF_URL = 'https://router.huggingface.co/v1/chat/completions'
const HF_MODEL = Deno.env.get('HF_MODEL') ?? 'meta-llama/Llama-3.1-8B-Instruct'
const HF_TIMEOUT_MS = 45_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function fail(status: number, error: string, code: string): Response {
  return json(status, { error, code })
}

async function callHuggingFace(messages: ReturnType<typeof buildMessages>): Promise<string> {
  const token = Deno.env.get('HF_TOKEN')
  if (!token) throw new Error('HF_TOKEN secret is not set')

  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: HF_MODEL, messages, max_tokens: 1200, temperature: 0.3 }),
    signal: AbortSignal.timeout(HF_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Hugging Face ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('Hugging Face returned an empty response')
  return content
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'Method not allowed', 'method_not_allowed')

  // 1. Authenticate as the caller (anonymous users included).
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth, error: authError } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
  if (authError || !auth.user) return fail(401, 'Authentication failed.', 'not_authenticated')

  // 2. Validate input.
  let body: { operation?: unknown; board_id?: unknown; input?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Invalid request body.', 'bad_request')
  }
  if (!isOperation(body.operation)) return fail(400, 'Unknown AI operation.', 'bad_request')
  if (typeof body.board_id !== 'string') return fail(400, 'board_id is required.', 'bad_request')
  const operation: Operation = body.operation
  const input = typeof body.input === 'string' ? body.input : undefined
  if (operation === 'generate_cards' && !input?.trim()) return fail(400, 'Describe an objective first.', 'bad_request')

  // 3. Load the board through RLS: only members can read it.
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id, name, workspace_id, columns(id, name, order_index, wip_limit, cards(title, priority, blocked, estimated_time_minutes, order_index))')
    .eq('id', body.board_id)
    .maybeSingle()
  if (boardError) {
    console.error('board load failed', boardError)
    return fail(500, 'Unable to load board.', 'board_load_failed')
  }
  if (!board) return fail(403, "This board doesn't exist or you don't have access to it.", 'forbidden')

  const snapshot: BoardSnapshot = {
    name: board.name,
    columns: [...(board.columns ?? [])]
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((c: any) => ({
        name: c.name,
        wip_limit: c.wip_limit,
        cards: [...(c.cards ?? [])].sort((a: any, b: any) => a.order_index - b.order_index),
      })),
  }

  // 4. Cheap pre-check so we don't call the model when the user can't pay.
  //    charge_ai_operation re-checks atomically afterwards.
  const { data: cost } = await supabase.rpc('ai_operation_cost', { p_operation: operation })
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('kb_token_balance')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (profileError || !profile) return fail(500, 'Unable to load your profile.', 'profile_missing')
  if (typeof cost === 'number' && profile.kb_token_balance < cost) {
    return fail(402, `Not enough kb_token. This needs ${cost}, you have ${profile.kb_token_balance}.`, 'insufficient_kb_tokens')
  }

  // 5. Run the model.
  const metadata = { input: input?.slice(0, 500) ?? null, model: HF_MODEL }
  let result: unknown
  try {
    const raw = await callHuggingFace(buildMessages(operation, snapshot, input))
    const parsed = extractJson(raw)
    result = operation === 'generate_cards' ? normalizeCards(parsed) : normalizeFindings(operation, parsed)
  } catch (err) {
    console.error(`AI operation ${operation} failed:`, err)
    const { error: logError } = await supabase.rpc('log_failed_ai_operation', {
      p_operation: operation,
      p_workspace_id: board.workspace_id,
      p_metadata: { ...metadata, error: String(err).slice(0, 300) },
    })
    if (logError) console.error('log_failed_ai_operation failed', logError)
    return fail(502, 'The AI service failed to respond. No kb_token were charged — please try again.', 'ai_failed')
  }

  // 6. Charge only after success; the result is withheld if charging fails.
  const { data: balance, error: chargeError } = await supabase.rpc('charge_ai_operation', {
    p_operation: operation,
    p_workspace_id: board.workspace_id,
    p_metadata: metadata,
  })
  if (chargeError) {
    console.error('charge_ai_operation failed', chargeError)
    if (chargeError.hint === 'insufficient_kb_tokens') return fail(402, chargeError.message, 'insufficient_kb_tokens')
    return fail(500, 'Your AI token balance could not be updated.', 'charge_failed')
  }

  return json(200, { result, balance, kb_token_cost: cost })
})
