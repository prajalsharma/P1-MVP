# Identity & Onboarding — P2 Frontend

## Routes

| Path | Component | Access |
|------|-----------|--------|
| `/login` | `AuthForm mode="login"` | Public |
| `/signup` | `AuthForm mode="signup"` | Public |
| `/auth/callback` | Route Handler | Public |
| `/onboarding/role` | Role selection | Auth, role = NULL |
| `/onboarding/org` | KYB-lite form | Auth, role = ORG_ADMIN, incomplete |
| `/org/pending-review` | Review pending page | Auth, requires_manual_review = true |
| `/vault` | Vault stub | Auth, onboarding complete |

## Auth Flow

```
Unauthenticated user
  └─ All routes → /login?next=<original>

Authenticated, role = NULL
  └─ /onboarding/role  (role selection)

Authenticated, role = INDIVIDUAL
  └─ /vault

Authenticated, role = ORG_ADMIN
  ├─ requires_manual_review = true → /org/pending-review
  ├─ onboarding_completed_at = NULL → /onboarding/org
  └─ complete → /vault
```

## AuthForm

`src/components/auth/AuthForm.tsx`

- Accepts `mode: "login" | "signup"`
- Uses `react-hook-form` + Zod for client-side validation
- Login schema: email + password (min 8 chars)
- Signup schema: email + password (min 8, max 72)
- Non-enumerating errors: "Incorrect email or password." (no user enumeration)
- "Check your email" success state on signup
- Google OAuth button via `supabase.auth.signInWithOAuth`
- `emailRedirectTo` → `/auth/callback`

## Middleware Route Guards

`src/middleware.ts`

Runs on every non-static request. Logic:

1. Calls `supabase.auth.getUser()` to refresh session
2. Fetches `profiles.role`, `.requires_manual_review`, `.onboarding_completed_at`
3. Deterministic redirect table:

| User state | Destination |
|---|---|
| Not authenticated | `/login?next=<original>` |
| Authenticated on public path | Redirect to role-appropriate page |
| role = NULL | `/onboarding/role` |
| role = INDIVIDUAL | Allow through (vault); onboarding paths redirect to `/vault` |
| role = ORG_ADMIN, requires_manual_review = true | `/org/pending-review` (all other routes blocked) |
| role = ORG_ADMIN, !onboarding_completed_at | `/onboarding/org` |
| role = ORG_ADMIN, complete | Allow through (vault); onboarding paths redirect to `/vault` |

## Auth Callback

`src/app/auth/callback/route.ts`

Exchanges the Supabase one-time `code` for a session via
`supabase.auth.exchangeCodeForSession(code)`. On success, redirects to `next`
param (default `/`). On failure, redirects to `/login?error=auth_callback_failed`.
Missing `code` param redirects to `/login?error=missing_code`.

## Role Immutability

Role is enforced as a one-way transition (`NULL → value`) at two layers:

1. **DB trigger** (`0005_role_immutability.sql`): `profiles_role_immutability` BEFORE UPDATE trigger on `profiles.role`. Raises SQLSTATE `23514` if `OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role`. Also stamps `role_set_at = now()` on first assignment.

2. **RPC idempotency guard** (`complete_onboarding`): If `profile.role IS NOT NULL`, returns `{ status: "already_set", role: <existing>, org_id: null }` immediately without any update.

Clients **never** write `role` directly. All role writes go through `complete_onboarding()` (SECURITY DEFINER), which is the only path that can mutate this field.

## Onboarding Fork

### INDIVIDUAL path

1. User selects "Individual" on `/onboarding/role`
2. Frontend calls `complete_onboarding({ p_role: "INDIVIDUAL" })`
3. RPC sets `role = INDIVIDUAL`, `requires_manual_review = false`
4. Emits `ROLE_SET` audit event
5. Middleware routes user to `/vault`

### ORG_ADMIN path

1. User selects "Organisation" on `/onboarding/role`
2. Frontend calls `complete_onboarding({ p_role: "ORG_ADMIN" })` — sets role only
3. Middleware routes to `/onboarding/org`
4. User submits KYB-lite form (legal name, display name, optional domain)
5. Frontend calls `complete_onboarding({ p_role: "ORG_ADMIN", p_org_legal_name, p_org_display_name, p_org_domain })`
6. RPC creates `organizations` row with `verification_status = PENDING_REVIEW`, sets `requires_manual_review = true`, emits `ORG_CREATED` + `ROLE_SET` audit events
7. Middleware routes user to `/org/pending-review` — **all other routes blocked** until `requires_manual_review` is cleared by an admin

## Manual Review Gate

All ORG_ADMIN registrations set `requires_manual_review = true` automatically via the `complete_onboarding` RPC. This flag is:

- **Set only** by the `complete_onboarding` SECURITY DEFINER function
- **Never writable** directly by the client (blocked by RLS policy `profiles_update_non_privileged` and the `profiles_block_privileged_update` trigger)
- **Enforced in middleware**: any authenticated ORG_ADMIN with `requires_manual_review = true` is unconditionally redirected to `/org/pending-review`

## Onboarding RPCs

Both role and org onboarding call the `complete_onboarding` Postgres RPC:

```ts
supabase.rpc("complete_onboarding", {
  p_role: "INDIVIDUAL" | "ORG_ADMIN",
  p_org_legal_name?: string | null,
  p_org_display_name?: string | null,
  p_org_domain?: string | null,
})
```

- INDIVIDUAL path: org fields = null, returns `{ status: "ok", role: "INDIVIDUAL", org_id: null, requires_review: false }`
- ORG_ADMIN path: org fields required, sets `requires_manual_review = true`, returns `{ status: "ok", role: "ORG_ADMIN", org_id: <uuid>, requires_review: true }`
- Idempotent: if role already set, returns `{ status: "already_set", role: <existing>, org_id: null }`

Audit events emitted:
- `ROLE_SET` — always, on first role assignment
- `ORG_CREATED` — ORG_ADMIN path only, when org row is created

## Privileged Profile Field Lock (P2-S4)

Direct client writes to `role`, `org_id`, `requires_manual_review`, and `manual_review_reason` are blocked at two layers:

1. **RLS policy** `profiles_update_non_privileged`: WITH CHECK condition rejects any UPDATE where these columns change from their current values
2. **Trigger** `profiles_block_privileged_update`: BEFORE UPDATE raises SQLSTATE `42501` on any change to these columns unless `arkova.bypass_privileged_check = '1'` is set (only the SECURITY DEFINER RPC sets this)

Users may update only `is_public` and `onboarding_completed_at` via direct UPDATE.

## Required Environment Variables

| Variable | Required | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Local only | Supabase project settings |
| `GOOGLE_CLIENT_ID` | For Google OAuth | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | For Google OAuth | Google Cloud Console |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your deployment URL |

## Testing

Unit tests (Vitest, no DB required):
```bash
bun run test
```
43 validator tests covering all Zod schemas.

RLS integration tests (requires local Supabase running):
```bash
bun run test:rls
```

Playwright E2E: **not configured** — no `playwright.config.ts` in repository. The following paths have no automated E2E coverage:
- Signup success state ("Check your email")
- Route guard paths (unauth → /login, role NULL → /onboarding/role, INDIVIDUAL → /vault, ORG_ADMIN incomplete → /onboarding/org)
- Role immutability (attempt to change role after set)
- Privileged field update rejection
- Org scoping

This is a known gap. Playwright setup is required to achieve full P2-S8 regression coverage.
