# Audit Events

## Overview

`audit_events` is an append-only compliance log. Every action that creates, modifies, or transitions a core entity must emit a row.

## Immutability Guarantee

Two database triggers enforce immutability at the storage layer:

| Trigger | Blocks |
|---------|--------|
| `audit_events_no_update` | `UPDATE` on any row |
| `audit_events_no_delete` | `DELETE` on any row |

Both raise exception code `42501` (insufficient privilege). This is enforced regardless of the caller's role, including service role at the SQL layer. The only way to correct an audit record is via a superseding `CORRECTION` event.

## Schema

```
audit_events (
  id             UUID PRIMARY KEY,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id  UUID REFERENCES profiles,
  actor_role     user_role,
  action         TEXT (1–128 chars),
  target_table   TEXT (1–64 chars),
  target_id      UUID,
  org_id         UUID REFERENCES organizations
)
```

## Action Vocabulary

Use the following action strings consistently:

| Action | Meaning |
|--------|---------|
| `PROFILE_CREATED` | New profile row inserted |
| `PROFILE_ROLE_SET` | Role assigned for the first time |
| `ORG_CREATED` | New organization created |
| `ORG_VERIFIED` | Org verification_status → VERIFIED |
| `ANCHOR_CREATED` | New anchor submitted |
| `ANCHOR_SECURED` | Anchor status → SECURED |
| `ANCHOR_REVOKED` | Anchor status → REVOKED |
| `ANCHOR_LEGAL_HOLD_SET` | legal_hold set to true |
| `ANCHOR_RETENTION_UPDATED` | retain_until or retention_policy changed |
| `ANCHOR_SOFT_DELETED` | deleted_at set |

## RLS Policies

| Policy | Who | What |
|--------|-----|------|
| `audit_events_insert_own` | Authenticated user | INSERT where `actor_user_id = auth.uid()` |
| `audit_events_select_own` | Authenticated user | SELECT own events |
| `audit_events_select_org_admin` | Org Admin | SELECT all events in their org |

Anonymous users cannot enumerate audit events (no SELECT policy for `anon` role).

## Indexes

- `occurred_at` — time-range queries
- `actor_user_id` — per-user audit trail
- `target_table` + `target_id` — targeted lookups
- `org_id` — org-scoped audit views
- `action` — action-type filtering
