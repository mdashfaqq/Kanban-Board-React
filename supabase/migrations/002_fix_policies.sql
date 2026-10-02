-- 002_fix_policies.sql
--
-- Makes Supabase the real source of truth for FlowKanban:
--   * supports Supabase Anonymous Auth (users without an email)
--   * replaces incomplete RLS policies with a consistent membership model
--   * atomic workspace creation (workspace + owner membership)
--   * server-side kb_token accounting (clients can no longer edit balances)
--   * card activity logging via trigger
--
-- Access model (workspace_members.role):
--   any member  -> read everything in the workspace
--   owner/admin/member -> create/edit cards, subtasks, labels, comments, dependencies
--   owner/admin -> manage boards, columns, sprints, insights, members
--   viewer      -> read only
--
-- Safe to re-run: every policy is dropped before it is (re)created.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Users: allow anonymous users (no email) and keep profiles in sync
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- When an anonymous user later links an email, copy it to the profile.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET email = NEW.email, updated_at = NOW() WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_change();

-- Backfill profiles for any auth users created before this migration
-- (e.g. sign-ups that failed the old NOT NULL email constraint).
INSERT INTO public.users (id, email, full_name, avatar_url)
SELECT id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Clients may edit their display fields only. kb_token_balance is changed
-- exclusively by charge_ai_operation() below.
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url, updated_at) ON public.users TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Authorization helpers
--    SECURITY DEFINER so policies can consult workspace_members without
--    recursing into workspace_members' own RLS policies.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_workspace_role(p_workspace_id UUID, p_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = auth.uid()
      AND (p_roles IS NULL OR m.role = ANY (p_roles))
  );
$$;

CREATE OR REPLACE FUNCTION public.board_workspace_id(p_board_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.boards WHERE id = p_board_id;
$$;

CREATE OR REPLACE FUNCTION public.column_workspace_id(p_column_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.workspace_id
  FROM public.columns c
  JOIN public.boards b ON b.id = c.board_id
  WHERE c.id = p_column_id;
$$;

CREATE OR REPLACE FUNCTION public.card_workspace_id(p_card_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.workspace_id
  FROM public.cards k
  JOIN public.columns c ON c.id = k.column_id
  JOIN public.boards b ON b.id = c.board_id
  WHERE k.id = p_card_id;
$$;

CREATE OR REPLACE FUNCTION public.shares_workspace_with(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them ON them.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid() AND them.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Drop every existing policy we are replacing
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Workspace members can view workspace" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace owners can update" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace owners can insert" ON public.workspaces;
DROP POLICY IF EXISTS "Members can view membership" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace members can view boards" ON public.boards;
DROP POLICY IF EXISTS "Workspace admins can manage boards" ON public.boards;
DROP POLICY IF EXISTS "Anyone can view cards in accessible workspaces" ON public.cards;
DROP POLICY IF EXISTS "Workspace members can manage cards" ON public.cards;
DROP POLICY IF EXISTS "Users can view own AI operations" ON public.ai_operations;
DROP POLICY IF EXISTS "Users can insert own AI operations" ON public.ai_operations;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.kb_token_transactions;
DROP POLICY IF EXISTS "Workspace members can view insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Workspace admins can manage insights" ON public.ai_insights;

-- ---------------------------------------------------------------------------
-- 4. Policies
-- ---------------------------------------------------------------------------

-- users -------------------------------------------------------------------
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_workspace_with(id));

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- workspaces --------------------------------------------------------------
-- owner_id = auth.uid() in SELECT lets the owner read a workspace even before
-- the membership row exists (fixes insert().select() during creation).
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_workspace_role(id));

DROP POLICY IF EXISTS workspaces_insert ON public.workspaces;
CREATE POLICY workspaces_insert ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workspaces_update ON public.workspaces;
CREATE POLICY workspaces_update ON public.workspaces
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_workspace_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (owner_id = auth.uid() OR public.has_workspace_role(id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS workspaces_delete ON public.workspaces;
CREATE POLICY workspaces_delete ON public.workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Ownership cannot be reassigned by a plain UPDATE.
REVOKE UPDATE ON public.workspaces FROM anon, authenticated;
GRANT UPDATE (name, mode, updated_at) ON public.workspaces TO authenticated;

-- workspace_members -------------------------------------------------------
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
CREATE POLICY workspace_members_select ON public.workspace_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_workspace_role(workspace_id));

-- Owners add anyone; admins add non-owners; a workspace's owner may bootstrap
-- their own 'owner' membership. Nobody can join an arbitrary workspace.
DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;
CREATE POLICY workspace_members_insert ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner'])
    OR (public.has_workspace_role(workspace_id, ARRAY['admin']) AND role <> 'owner')
    OR (
      user_id = auth.uid()
      AND role = 'owner'
      AND EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;
CREATE POLICY workspace_members_update ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner']));

DROP POLICY IF EXISTS workspace_members_delete ON public.workspace_members;
CREATE POLICY workspace_members_delete ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']) AND role <> 'owner')
    OR (user_id = auth.uid() AND role <> 'owner')
  );

-- boards ------------------------------------------------------------------
DROP POLICY IF EXISTS boards_select ON public.boards;
CREATE POLICY boards_select ON public.boards
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(workspace_id));

DROP POLICY IF EXISTS boards_manage ON public.boards;
CREATE POLICY boards_manage ON public.boards
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- columns -----------------------------------------------------------------
DROP POLICY IF EXISTS columns_select ON public.columns;
CREATE POLICY columns_select ON public.columns
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.board_workspace_id(board_id)));

DROP POLICY IF EXISTS columns_manage ON public.columns;
CREATE POLICY columns_manage ON public.columns
  FOR ALL TO authenticated
  USING (public.has_workspace_role(public.board_workspace_id(board_id), ARRAY['owner', 'admin']))
  WITH CHECK (public.has_workspace_role(public.board_workspace_id(board_id), ARRAY['owner', 'admin']));

-- cards -------------------------------------------------------------------
DROP POLICY IF EXISTS cards_select ON public.cards;
CREATE POLICY cards_select ON public.cards
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.column_workspace_id(column_id)));

DROP POLICY IF EXISTS cards_manage ON public.cards;
CREATE POLICY cards_manage ON public.cards
  FOR ALL TO authenticated
  USING (public.has_workspace_role(public.column_workspace_id(column_id), ARRAY['owner', 'admin', 'member']))
  WITH CHECK (public.has_workspace_role(public.column_workspace_id(column_id), ARRAY['owner', 'admin', 'member']));

-- labels ------------------------------------------------------------------
DROP POLICY IF EXISTS labels_select ON public.labels;
CREATE POLICY labels_select ON public.labels
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(workspace_id));

DROP POLICY IF EXISTS labels_manage ON public.labels;
CREATE POLICY labels_manage ON public.labels
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']));

-- card_labels -------------------------------------------------------------
DROP POLICY IF EXISTS card_labels_select ON public.card_labels;
CREATE POLICY card_labels_select ON public.card_labels
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.card_workspace_id(card_id)));

-- The label must belong to the same workspace as the card.
DROP POLICY IF EXISTS card_labels_manage ON public.card_labels;
CREATE POLICY card_labels_manage ON public.card_labels
  FOR ALL TO authenticated
  USING (public.has_workspace_role(public.card_workspace_id(card_id), ARRAY['owner', 'admin', 'member']))
  WITH CHECK (
    public.has_workspace_role(public.card_workspace_id(card_id), ARRAY['owner', 'admin', 'member'])
    AND EXISTS (
      SELECT 1 FROM public.labels l
      WHERE l.id = label_id AND l.workspace_id = public.card_workspace_id(card_id)
    )
  );

-- subtasks ----------------------------------------------------------------
DROP POLICY IF EXISTS subtasks_select ON public.subtasks;
CREATE POLICY subtasks_select ON public.subtasks
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.card_workspace_id(card_id)));

DROP POLICY IF EXISTS subtasks_manage ON public.subtasks;
CREATE POLICY subtasks_manage ON public.subtasks
  FOR ALL TO authenticated
  USING (public.has_workspace_role(public.card_workspace_id(card_id), ARRAY['owner', 'admin', 'member']))
  WITH CHECK (public.has_workspace_role(public.card_workspace_id(card_id), ARRAY['owner', 'admin', 'member']));

-- dependencies ------------------------------------------------------------
-- Both cards must be editable by the caller.
DROP POLICY IF EXISTS dependencies_select ON public.dependencies;
CREATE POLICY dependencies_select ON public.dependencies
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.card_workspace_id(blocked_id)));

DROP POLICY IF EXISTS dependencies_manage ON public.dependencies;
CREATE POLICY dependencies_manage ON public.dependencies
  FOR ALL TO authenticated
  USING (
    public.has_workspace_role(public.card_workspace_id(blocker_id), ARRAY['owner', 'admin', 'member'])
    AND public.has_workspace_role(public.card_workspace_id(blocked_id), ARRAY['owner', 'admin', 'member'])
  )
  WITH CHECK (
    public.has_workspace_role(public.card_workspace_id(blocker_id), ARRAY['owner', 'admin', 'member'])
    AND public.has_workspace_role(public.card_workspace_id(blocked_id), ARRAY['owner', 'admin', 'member'])
  );

-- comments ----------------------------------------------------------------
ALTER TABLE public.comments ALTER COLUMN user_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.card_workspace_id(card_id)));

DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_workspace_role(public.card_workspace_id(card_id), ARRAY['owner', 'admin', 'member'])
  );

DROP POLICY IF EXISTS comments_update_own ON public.comments;
CREATE POLICY comments_update_own ON public.comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS comments_delete ON public.comments;
CREATE POLICY comments_delete ON public.comments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_workspace_role(public.card_workspace_id(card_id), ARRAY['owner', 'admin'])
  );

-- activity_logs -----------------------------------------------------------
-- Read-only for clients; rows are written by the log_card_activity trigger.
DROP POLICY IF EXISTS activity_logs_select ON public.activity_logs;
CREATE POLICY activity_logs_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.card_workspace_id(card_id)));

REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM anon, authenticated;

-- sprints -----------------------------------------------------------------
DROP POLICY IF EXISTS sprints_select ON public.sprints;
CREATE POLICY sprints_select ON public.sprints
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(public.board_workspace_id(board_id)));

DROP POLICY IF EXISTS sprints_manage ON public.sprints;
CREATE POLICY sprints_manage ON public.sprints
  FOR ALL TO authenticated
  USING (public.has_workspace_role(public.board_workspace_id(board_id), ARRAY['owner', 'admin']))
  WITH CHECK (public.has_workspace_role(public.board_workspace_id(board_id), ARRAY['owner', 'admin']));

-- ai_insights -------------------------------------------------------------
DROP POLICY IF EXISTS ai_insights_select ON public.ai_insights;
CREATE POLICY ai_insights_select ON public.ai_insights
  FOR SELECT TO authenticated
  USING (public.has_workspace_role(workspace_id));

DROP POLICY IF EXISTS ai_insights_manage ON public.ai_insights;
CREATE POLICY ai_insights_manage ON public.ai_insights
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- ai_operations / kb_token_transactions -----------------------------------
-- Users read their own history. Rows are written only by
-- charge_ai_operation() / log_failed_ai_operation(), so a client cannot forge
-- receipts, credit itself, or write rows for another user.
DROP POLICY IF EXISTS ai_operations_select_own ON public.ai_operations;
CREATE POLICY ai_operations_select_own ON public.ai_operations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS kb_token_transactions_select_own ON public.kb_token_transactions;
CREATE POLICY kb_token_transactions_select_own ON public.kb_token_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.ai_operations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.kb_token_transactions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC: atomic workspace creation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_workspace(p_name TEXT, p_mode TEXT)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_workspace public.workspaces;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.workspaces (name, mode, owner_id)
  VALUES (trim(p_name), p_mode, v_uid)
  RETURNING * INTO v_workspace;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace.id, v_uid, 'owner');

  RETURN v_workspace;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: kb_token accounting
--    Costs live on the server so the client cannot choose its own price.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ai_operation_cost(p_operation TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_operation
    WHEN 'generate_cards' THEN 5
    WHEN 'break_down_task' THEN 3
    WHEN 'board_analysis' THEN 8
    WHEN 'sprint_summary' THEN 3
    WHEN 'workflow_optimization' THEN 10
    WHEN 'dependency_analysis' THEN 8
    WHEN 'what_if_analysis' THEN 6
  END;
$$;

-- Call AFTER the AI operation succeeds. Atomically checks the balance,
-- deducts it, and writes the transaction + operation receipt.
-- Returns the new balance.
CREATE OR REPLACE FUNCTION public.charge_ai_operation(
  p_operation TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cost INTEGER := public.ai_operation_cost(p_operation);
  v_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Unknown AI operation: %', p_operation USING ERRCODE = '22023';
  END IF;
  IF p_workspace_id IS NOT NULL AND NOT public.has_workspace_role(p_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  SELECT kb_token_balance INTO v_balance
  FROM public.users WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient kb_token balance. Required: %, available: %', v_cost, v_balance
      USING ERRCODE = 'P0001', HINT = 'insufficient_kb_tokens';
  END IF;

  UPDATE public.users
  SET kb_token_balance = v_balance - v_cost, updated_at = NOW()
  WHERE id = v_uid;

  INSERT INTO public.kb_token_transactions (user_id, workspace_id, amount, operation, balance_after)
  VALUES (v_uid, p_workspace_id, -v_cost, p_operation, v_balance - v_cost);

  INSERT INTO public.ai_operations (user_id, workspace_id, operation, kb_token_cost, request_metadata, result_status)
  VALUES (v_uid, p_workspace_id, p_operation, v_cost, COALESCE(p_metadata, '{}'::JSONB), 'success');

  RETURN v_balance - v_cost;
END;
$$;

-- Records a failed AI operation without charging (kb_token_cost = 0).
CREATE OR REPLACE FUNCTION public.log_failed_ai_operation(
  p_operation TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF public.ai_operation_cost(p_operation) IS NULL THEN
    RAISE EXCEPTION 'Unknown AI operation: %', p_operation USING ERRCODE = '22023';
  END IF;
  IF p_workspace_id IS NOT NULL AND NOT public.has_workspace_role(p_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ai_operations (user_id, workspace_id, operation, kb_token_cost, request_metadata, result_status)
  VALUES (v_uid, p_workspace_id, p_operation, 0, COALESCE(p_metadata, '{}'::JSONB), 'failed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.charge_ai_operation(TEXT, UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_failed_ai_operation(TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_ai_operation(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_failed_ai_operation(TEXT, UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Card activity log (server-side, atomic with the card change)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_card_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (card_id, user_id, action, new_value)
    VALUES (NEW.id, v_uid, 'card_created',
      jsonb_build_object('title', NEW.title, 'priority', NEW.priority, 'column_id', NEW.column_id));
    RETURN NEW;
  END IF;

  IF NEW.column_id IS DISTINCT FROM OLD.column_id OR NEW.order_index IS DISTINCT FROM OLD.order_index THEN
    INSERT INTO public.activity_logs (card_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, v_uid, 'card_moved',
      jsonb_build_object('column_id', OLD.column_id, 'order_index', OLD.order_index),
      jsonb_build_object('column_id', NEW.column_id, 'order_index', NEW.order_index));
  END IF;

  IF NEW.blocked IS DISTINCT FROM OLD.blocked THEN
    INSERT INTO public.activity_logs (card_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, v_uid, CASE WHEN NEW.blocked THEN 'card_blocked' ELSE 'card_unblocked' END,
      jsonb_build_object('blocked', OLD.blocked),
      jsonb_build_object('blocked', NEW.blocked, 'blocker_reason', NEW.blocker_reason));
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.activity_logs (card_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, v_uid, 'priority_changed',
      jsonb_build_object('priority', OLD.priority), jsonb_build_object('priority', NEW.priority));
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.activity_logs (card_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, v_uid, 'assignee_changed',
      jsonb_build_object('assignee_id', OLD.assignee_id), jsonb_build_object('assignee_id', NEW.assignee_id));
  END IF;

  IF NEW.completion_date IS NOT NULL AND OLD.completion_date IS NULL THEN
    INSERT INTO public.activity_logs (card_id, user_id, action, new_value)
    VALUES (NEW.id, v_uid, 'card_completed', jsonb_build_object('completion_date', NEW.completion_date));
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.estimated_time_minutes IS DISTINCT FROM OLD.estimated_time_minutes THEN
    INSERT INTO public.activity_logs (card_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, v_uid, 'card_updated',
      jsonb_build_object('title', OLD.title, 'description', OLD.description),
      jsonb_build_object('title', NEW.title, 'description', NEW.description));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_card_activity ON public.cards;
CREATE TRIGGER on_card_activity
  AFTER INSERT OR UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.log_card_activity();

-- ---------------------------------------------------------------------------
-- 8. Indexes used by the policies above
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_boards_workspace_id ON public.boards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_columns_board_id ON public.columns(board_id);

COMMIT;
