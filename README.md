# MindSense

MindSense is a Vite, React, and TypeScript mental wellness application backed by Supabase Auth, Postgres, Storage, Row Level Security policies, and SQL RPC functions.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/Radix UI
- Backend: Supabase Auth, PostgREST, Storage, SQL functions
- Database: Supabase Postgres migrations in `supabase/migrations`
- Tests: Vitest with jsdom

## Environment

Create `.env` from `.env.example` and fill in the values from Supabase Project Settings > API:

```env
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-or-anon-key"
```

Use the publishable or anon key only. Do not put a Supabase service role key in frontend environment variables.

## Run Locally

```powershell
npm install
npm run dev
```

The Vite dev server uses port `8080` by default:

```text
http://localhost:8080
```

## Validate

```powershell
npm run lint
npm run test
npm run build
npm audit
```

## Supabase Setup

If a resumed or newly linked Supabase project is reachable but app tables return `PGRST205`, the database schema has not been applied to that project. Link the CLI and push migrations:

```powershell
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
npx supabase migration list --linked
```

The local Supabase project ref is stored in `supabase/config.toml`. Keep it aligned with `VITE_SUPABASE_PROJECT_ID`.
