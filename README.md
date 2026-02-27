# Arkova

P1-MVP — identity and onboarding platform built with Next.js 15, Supabase, and TypeScript.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ **or** [Bun](https://bun.sh/) 1.1+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) 1.x

```bash
# Install Supabase CLI via npm (or brew install supabase/tap/supabase)
npm install -g supabase
```

---

## 1. Clone and install dependencies

```bash
git clone https://github.com/prajalsharma/P1-MVP.git
cd P1-MVP
bun install        # or: npm install
```

---

## 2. Start local Supabase

Make sure Docker Desktop is running, then:

```bash
supabase start
```

The output will print three values you need — copy them:

```
API URL:          http://127.0.0.1:54321
anon key:         eyJ...
service_role key: eyJ...
```

---

## 3. Apply migrations and seed data

```bash
supabase db reset
```

This runs all migrations in `supabase/migrations/` (0001–0014) and then `supabase/seed.sql`.

---

## 4. Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the values from the `supabase start` output:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Google OAuth (required for social login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and create an OAuth 2.0 Client ID (Web application).
2. Add these to **Authorized redirect URIs**:
   - `http://localhost:3000/auth/callback`
   - `http://127.0.0.1:54321/auth/v1/callback`
3. Copy the Client ID and Secret into `.env.local`:

```bash
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

---

## 5. Start the development server

```bash
bun run dev        # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Next.js dev server |
| `bun run build` | Production build |
| `bun run typecheck` | TypeScript type check |
| `bun run test` | Unit tests (vitest) |
| `bun run test:rls` | RLS policy tests (requires local Supabase) |
| `bun run test:all` | Run all tests |
| `bun run lint:copy` | Check for disallowed copy terms |
| `bun run gen:types` | Regenerate database types from Supabase |
| `supabase db reset` | Wipe and re-apply all migrations + seed |
| `supabase stop` | Stop local Supabase containers |

---

## Project structure

```
src/
  app/
    login/             # Login page
    signup/            # Sign-up page
    onboarding/
      role/            # Step 1: choose INDIVIDUAL or ORG_ADMIN
      org/             # Step 2: organisation details (ORG_ADMIN only)
    org/
      pending-review/  # Shown while manual review is in progress
      registry/        # Org admin registry table
      bulk/            # Bulk verification wizard
    vault/             # Main dashboard (post-onboarding)
    anchors/[id]/      # Anchor detail view
    affiliations/      # Affiliations placeholder
    auth/callback/     # Supabase OAuth callback handler
  components/
    auth/AuthForm      # Shared sign-in / sign-up form
  lib/
    supabase/          # Browser + server Supabase clients, middleware helper
    validators.ts      # Zod schemas

supabase/
  migrations/          # 0001–0014 SQL migrations
  seed.sql             # Local dev seed data
  config.toml          # Supabase local config

tests/                 # Unit tests
scripts/               # Dev tooling scripts
docs/                  # Confluence-style architecture docs
```
