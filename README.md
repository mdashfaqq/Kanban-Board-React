# FlowKanban

**Plan less. Flow better.**

A production-quality, AI-powered Personal + Team Kanban platform with Flow Intelligence.

## 🎯 Product Vision

FlowKanban is not just "a Kanban board with a chatbot." It's a hybrid Kanban platform with AI-powered workflow intelligence that:

- Understands board structure and history
- Identifies workflow problems
- Breaks down work intelligently
- Detects dependencies and bottlenecks
- Provides actionable recommendations
- Keeps the user in control

## ✨ Key Features

### Core Kanban
- Professional Kanban board with drag-and-drop
- Custom columns with WIP limits
- Rich card metadata (priority, labels, assignee, due dates, estimates)
- Multiple board templates (Personal, Software, Marketing)
- Activity history tracking

### AI Flow Intelligence
- **Smart Card Generation** - AI breaks down vague objectives into actionable cards
- **Task Breakdown** - AI analyzes large tasks and proposes subtasks
- **Bottleneck Detection** - Identifies WIP violations, stale cards, blocked work
- **Flow Health Dashboard** - Metrics on WIP, cycle time, throughput
- **WIP Recommendations** - Smart suggestions based on board data
- **Dependency Intelligence** - Visualizes and analyzes task dependencies
- **Sprint Summaries** - AI-generated sprint recaps
- **Personal Focus Mode** - AI-recommended tasks for focused work

### Dual Mode
- **Personal Mode** - Focus, task overload, prioritization, personal WIP
- **Team Mode** - WIP, bottlenecks, cycle time, throughput, team workload

### AI Usage Credits (kb_token)
- Internal AI usage credit system
- Every AI operation consumes kb_token
- Transparent usage tracking
- Configurable costs per operation

## 🚀 Quick Start

Supabase is the source of truth: every workspace, board, card and kb_token
change is stored in PostgreSQL and protected by Row Level Security. There is
no localStorage fallback — if a write fails, the UI shows an error.

### Prerequisites
- Node.js 18+
- A Supabase project (free tier is fine)

### 1. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the values from **Supabase Dashboard → Project Settings → API**:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://abcd1234.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The **anon / publishable** key |

`VITE_` variables are bundled into the browser build. **Never** put the
`service_role` key in this project — RLS is what keeps data safe, and the
service key bypasses it.

### 2. Enable Anonymous Sign-Ins

**Dashboard → Authentication → Sign In / Providers → Allow anonymous sign-ins → Save.**

Without this, the app stops at "Authentication failed".

### 3. Run the migrations

Open **Dashboard → SQL Editor** and run each file in order (paste the contents, click *Run*):

1. `supabase/migrations/001_initial_schema.sql` — tables, base policies, signup trigger
2. `supabase/migrations/002_fix_policies.sql` — anonymous-user support, complete RLS policies, `create_workspace` / `charge_ai_operation` RPCs, card activity trigger

`002` runs in a transaction and is safe to re-run. If you use the Supabase CLI instead:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Start the app

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

Other scripts:

```bash
npm run build     # type-check + production build
npm test          # unit tests (vitest)
```

## 🔑 How authentication works

The app uses **Supabase Anonymous Auth**, so there is no login screen but every
browser still gets a real Supabase user with a UUID.

1. On load, `AuthProvider` (`src/lib/auth.tsx`) checks for a stored session.
2. If one exists, it is verified with `supabase.auth.getUser()`; otherwise the
   app calls `supabase.auth.signInAnonymously()` (once — concurrent calls are de-duplicated).
3. A database trigger creates the matching `public.users` profile (100 kb_token to start).
4. The profile is loaded, and only then are pages rendered. Until then the app
   shows *Initializing… / Signing in… / Loading your profile…*, or an error with *Try again*.

The session is persisted by supabase-js in the browser, so the same anonymous
user (and their data) comes back after a refresh or browser restart. Clearing
site data or using a private window creates a new anonymous user.

Services never take a user id from the caller: they read it from the session
(`getCurrentUserId()` in `src/services/auth.ts`), and the database checks
`auth.uid()` regardless.

## 🛡️ How RLS protects data

Access is based on `workspace_members.role`:

| Role | Can do |
| --- | --- |
| any member | read everything in the workspace |
| owner / admin / member | create and edit cards, subtasks, labels, comments, dependencies |
| owner / admin | manage boards, columns, sprints, AI insights, members |
| viewer | read only |

- Policies use `SECURITY DEFINER` helpers (`has_workspace_role`, `board_workspace_id`,
  `column_workspace_id`, `card_workspace_id`) so they don't recurse into each other.
- Workspaces are created with the `create_workspace` RPC, which inserts the
  workspace and the owner membership in one transaction.
- Nobody can add themselves to a workspace they don't own or administer.
- `activity_logs` are written by a trigger on `cards`; clients can only read them.
- Users can update their `full_name` / `avatar_url`, but **not** `kb_token_balance`.

## 🤖 AI with Hugging Face

AI runs in the `ai` Supabase Edge Function (`supabase/functions/ai/`), never in
the browser, so your Hugging Face token stays secret and users can't get AI
results without being charged.

1. Create a token at https://huggingface.co/settings/tokens — **Fine-grained**,
   with **"Make calls to Inference Providers"** enabled.
2. Deploy the function and set the secrets:

   ```bash
   npx supabase login
   npx supabase secrets set HF_TOKEN=hf_your_token --project-ref <your-project-ref>
   npx supabase functions deploy ai --project-ref <your-project-ref>
   ```

   Optional: choose a different chat model (any model available on HF Inference Providers):

   ```bash
   npx supabase secrets set HF_MODEL=Qwen/Qwen2.5-72B-Instruct --project-ref <your-project-ref>
   ```

   Default: `meta-llama/Llama-3.1-8B-Instruct`.
3. Run `supabase/migrations/003_ai_focus_cost.sql` in the SQL Editor.

The function verifies the user, loads the board through RLS, calls the model,
validates its JSON, and only then calls `charge_ai_operation`. If the model
fails, nothing is charged. Logs: **Dashboard → Edge Functions → ai → Logs**.

## 🪙 How kb_token accounting works

1. The `ai` Edge Function checks the balance and runs the model on Hugging Face.
2. **Only if it succeeds**, it calls the `charge_ai_operation(operation, workspace_id, metadata)` RPC, which in one transaction:
   - looks up the price on the server (`ai_operation_cost`) — the client can't choose it
   - locks the user row, rejects the charge if the balance is too low
   - deducts the balance, writes a `kb_token_transactions` row and an `ai_operations` receipt
3. If the operation fails, `log_failed_ai_operation` records a `failed` receipt and nothing is charged.

Clients cannot insert into `kb_token_transactions` or `ai_operations` directly,
and cannot edit their balance.

## 🧰 Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Authentication failed. Enable Anonymous Sign-Ins…" | Turn on anonymous sign-ins (step 2). |
| "Database error saving new user" / "profile is missing" | Migration `002` hasn't been applied (anonymous users have no email, which `001` alone rejects). |
| "You don't have permission to perform this action." | RLS denied the request — you're not a member of that workspace, or your role is too low. Check `workspace_members`. |
| "Missing VITE_SUPABASE_URL…" | `.env.local` is missing; restart `npm run dev` after creating it. |
| Data disappeared | A new anonymous user was created (site data cleared / private window). Old rows still exist under the old user id. |
| Function `create_workspace` not found | Run migration `002`. |

In development, every failed Supabase call is logged to the browser console
with its `code`, `message`, `details` and `hint`.

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/            # shadcn/ui components
│   ├── AppLayout.tsx  # Sidebar + page shell
│   └── Toaster.tsx    # Success / error toasts
├── lib/
│   ├── auth.tsx       # AuthProvider: anonymous sign-in, session, profile
│   ├── errors.ts      # AppError + Supabase error mapping
│   ├── supabase.ts    # Supabase client
│   ├── theme.ts       # Light/dark preference (the only localStorage use)
│   └── utils.ts
├── pages/
├── services/          # All database access (throws AppError on failure)
│   ├── auth.ts        # Current user id + profile
│   ├── workspace.ts
│   ├── board.ts
│   └── ai.ts          # AI operations + kb_token charging
├── types/database.ts
├── App.tsx            # Auth gate + routes
└── main.tsx
supabase/migrations/   # 001 schema, 002 policies/RPCs
```

## 🛠️ Tech Stack

### Frontend
- React 18 with TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Lucide React (icons)
- Recharts (charts)

### Backend
- Supabase (PostgreSQL)
- Supabase Auth
- Supabase Realtime (ready)
- Supabase Storage (ready)

### AI
- Hugging Face (ready for integration)
- Currently using simulated responses

## 📊 Database Schema

The application uses a comprehensive relational schema with:

- Users with kb_token balance
- Workspaces (personal/team)
- Workspace members with roles
- Boards with templates
- Columns with WIP limits
- Cards with full metadata
- Labels, subtasks, dependencies
- Comments and activity logs
- Sprints
- AI operations and transactions
- AI insights

See `supabase/migrations/001_initial_schema.sql` for the full schema.

## 🔐 Security

- Row Level Security on every table, keyed on `auth.uid()` and workspace membership
- Real Supabase Auth users (anonymous) — no fake or client-chosen user ids
- Only the public anon key ships to the browser; no service-role key in the frontend
- kb_token balance changes only through the server-side `charge_ai_operation` RPC
- No silent fallbacks: failed writes are reported to the user, never faked

## 🎨 Design Principles

- Modern SaaS aesthetic
- Clean and minimal
- Information-dense
- Accessible
- Responsive (desktop, tablet, mobile)
- Dark mode support

## 📖 Documentation

- [Setup Guide](SETUP.md) - Detailed setup instructions
- [Database Schema](supabase/migrations/001_initial_schema.sql) - Full schema with RLS

## 🔄 Status

### ✅ Implemented
- User authentication
- Workspace management
- Board management with templates
- Kanban board with drag-and-drop
- Column and card management
- Activity history
- kb_token accounting
- AI operations (simulated)
- **AI Command Center** - Natural language and quick commands
- **Smart Card Generation** - AI breaks down objectives into cards
- **Analytics Dashboard** - Flow health, metrics, and recommendations
- TypeScript migration
- Tailwind CSS + shadcn/ui
- Responsive UI
- Dark mode

### 🚧 In Progress
- Hugging Face AI integration
- Dependency visualization
- Analytics dashboard
- Sprint management UI

### 📋 Planned
- Task size intelligence
- Bottleneck prediction
- Critical path calculation
- Personal focus mode
- Team workload analysis
- Real-time updates
- File attachments
- Subtask UI
- Permission management UI

## 🤝 Contributing

This is a demonstration project. For production use, consider:

1. Adding comprehensive tests
2. Implementing real AI integration
3. Adding analytics dashboard
4. Implementing real-time features
5. Adding file upload functionality
6. Improving error handling
7. Adding more AI features

## 📄 License

MIT

## 🙏 Acknowledgments

Built with:
- React and the React team
- Supabase for the excellent backend
- shadcn for the beautiful UI components
- Tailwind CSS for the styling system
- The open-source community

---

**FlowKanban** - Plan less. Flow better.
