# FlowKanban - Setup Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account (you already have one)
- Supabase project: https://kljsqqinxzwddgdlwxwh.supabase.co

## Database Setup

### Step 1: Apply Database Schema

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Create a new query
5. Copy the contents of `supabase/migrations/001_initial_schema.sql`
6. Paste it into the SQL Editor
7. Click "Run" to execute the schema

### Step 2: Verify Tables

After running the migration, verify the following tables were created:
- users
- workspaces
- workspace_members
- boards
- columns
- cards
- labels
- card_labels
- subtasks
- dependencies
- comments
- activity_logs
- sprints
- ai_operations
- kb_token_transactions
- ai_insights

## Running the Application

### Development

```bash
npm install
npm run dev
```

The application will be available at http://localhost:5173 (or 5174 if 5173 is in use).

### Production Build

```bash
npm run build
npm run preview
```

## Environment Variables

The application uses `.env.local` for environment variables (already configured):

```
VITE_SUPABASE_URL=https://kljsqqinxzwddgdlwxwh.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Features Implemented

### Core Features
- ✅ User authentication (Sign up / Sign in)
- ✅ Workspace management (Personal & Team modes)
- ✅ Board management with templates
- ✅ Kanban board with drag-and-drop
- ✅ Column management with WIP limits
- ✅ Card management (title, description, priority, etc.)
- ✅ Activity history tracking
- ✅ kb_token accounting system
- ✅ AI operations (simulated - ready for Hugging Face integration)

### Frontend
- ✅ TypeScript migration
- ✅ Tailwind CSS integration
- ✅ shadcn/ui components
- ✅ Responsive design
- ✅ Dark mode support
- ✅ Modern SaaS UI

### Pages
- ✅ Dashboard (workspace list)
- ✅ Workspace view (board list)
- ✅ Board view (Kanban board)
- ✅ AI Usage dashboard
- ✅ Settings page

### Backend Services
- ✅ Supabase client configuration
- ✅ Authentication service
- ✅ Workspace service
- ✅ Board service
- ✅ AI service (with simulated responses)

## AI Features (Simulated)

The current implementation uses simulated AI responses. To integrate real Hugging Face AI:

1. Get a Hugging Face API key
2. Add it to environment variables
3. Update `src/services/ai.ts` to call Hugging Face API
4. Replace the simulate* functions with real API calls

### AI Operations Costs (kb_token)
- Generate cards: 5 kb_token
- Break down task: 3 kb_token
- Board analysis: 8 kb_token
- Sprint summary: 3 kb_token
- Workflow optimization: 10 kb_token
- Dependency analysis: 8 kb_token
- What-if analysis: 6 kb_token

## Database Schema

The schema includes:
- Users with kb_token balance
- Workspaces (personal/team)
- Workspace members with roles
- Boards with templates
- Columns with WIP limits
- Cards with full metadata
- Labels and card-labels
- Subtasks
- Dependencies
- Comments
- Activity logs
- Sprints
- AI operations log
- kb_token transactions
- AI insights

## Row Level Security (RLS)

All tables have RLS policies:
- Users can only access their own data
- Workspace members can access workspace data
- Workspace admins can manage boards
- AI operations are user-scoped

## Next Steps

To complete the full FlowKanban experience:

1. **Apply database schema** in Supabase dashboard
2. **Test authentication** - sign up and sign in
3. **Create a workspace** - personal or team
4. **Create a board** - choose a template
5. **Add cards** - test the Kanban board
6. **Test AI features** - try generating cards (currently simulated)
7. **Integrate Hugging Face** - replace simulated AI with real API
8. **Add more AI features**:
   - Task size intelligence
   - Bottleneck prediction
   - Dependency graph visualization
   - Critical path calculation
   - Personal focus mode
   - Team workload analysis
   - Sprint summaries
   - Analytics dashboard (CFD, cycle time scatter plot)
9. **Add tests** - comprehensive test coverage
10. **Deploy** - to Vercel, Netlify, or similar

## Known Limitations

- AI responses are simulated (not real LLM calls)
- No real-time updates (WebSocket not implemented)
- No file attachments
- No subtask UI (backend exists, no frontend)
- No dependency visualization (backend exists, no frontend)
- No analytics dashboard (backend logic exists, no UI)
- No team member management UI
- No sprint management UI
- No permission management UI

## Architecture

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- shadcn/ui for components
- React Router for navigation
- Lucide React for icons
- Recharts for charts (ready for analytics)

### Backend
- Supabase (PostgreSQL)
- Supabase Auth for authentication
- Supabase Realtime (ready to use)
- Supabase Storage (ready for file attachments)

### State Management
- React hooks (useState, useEffect)
- Supabase client for data fetching
- Local component state for UI

## Troubleshooting

### Build Errors
If you encounter TypeScript errors:
```bash
npm run build
```
Check the error messages and fix accordingly.

### Database Connection
If the app can't connect to Supabase:
1. Verify `.env.local` has correct values
2. Check Supabase project is active
3. Verify RLS policies allow access

### Authentication Issues
If authentication fails:
1. Check Supabase Auth is enabled
2. Verify email confirmation settings
3. Check RLS policies on users table

## Support

For issues with:
- Supabase: https://supabase.com/docs
- React: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
