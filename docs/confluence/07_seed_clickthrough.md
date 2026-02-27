# Seed Click-Through Guide

## Purpose

This document describes the development seed data loaded by `supabase/seed.sql` and how to verify it after `supabase db reset`.

## What the Seed Creates

| Record | UUID | Email | Role | Org |
|--------|------|-------|------|-----|
| Admin Organization | `00000000-0000-0000-0000-000000000001` | — | — | — |
| Individual User (profile) | `00000000-0000-0000-0001-000000000001` | `individual@test.arkova.com` | `INDIVIDUAL` | None |
| Org Admin User (profile) | `00000000-0000-0000-0001-000000000002` | `orgadmin@test.arkova.com` | `ORG_ADMIN` | Arkova |

## How to Load

```bash
supabase db reset
```

This drops and recreates the local database, applies all migrations in order (0001–0011), then executes `seed.sql`.

## Verification Queries

After reset, run these in the Supabase Studio SQL editor or `psql`:

```sql
-- 1. Confirm Admin Org exists and is VERIFIED
SELECT id, legal_name, verification_status FROM organizations;

-- 2. Confirm Individual user profile
SELECT id, email, role, org_id FROM profiles WHERE role = 'INDIVIDUAL';

-- 3. Confirm Org Admin user profile is linked to the org
SELECT p.email, p.role, o.display_name AS org
FROM profiles p
JOIN organizations o ON o.id = p.org_id
WHERE p.role = 'ORG_ADMIN';
```

## Expected Results

```
 id                                   | legal_name           | verification_status
--------------------------------------+----------------------+---------------------
 00000000-0000-0000-0000-000000000001 | Arkova Internal Ltd. | VERIFIED

 id                                   | email                           | role       | org_id
--------------------------------------+---------------------------------+------------+--------
 00000000-0000-0000-0001-000000000001 | individual@test.arkova.com      | INDIVIDUAL | null

 email                      | role      | org
----------------------------+-----------+--------
 orgadmin@test.arkova.com   | ORG_ADMIN | Arkova
```

## Notes

- These UUIDs are deterministic for local dev only. They are never used in production.
- The `auth.users` rows corresponding to these profiles must be created separately via Supabase auth admin API for sign-in to work.
- `ON CONFLICT (id) DO NOTHING` ensures the seed is idempotent.
