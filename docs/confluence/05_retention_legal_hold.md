# Retention & Legal Hold

## Overview

Arkova implements a two-layer retention model:

1. **Retention Policy** — time-based expiry of evidence records
2. **Legal Hold** — indefinite preservation that overrides all deletion logic

## Retention Policy

Each anchor has a `retention_policy` field (TEXT, default `STANDARD`) and an optional `retain_until` timestamp.

| Policy Value | Description |
|--------------|-------------|
| `STANDARD` | Default. Retained until `retain_until` elapses or manual deletion. |
| `EXTENDED` | Extended commercial retention period. |
| `LEGAL` | Retained for legal proceedings. Typically paired with `legal_hold = true`. |

Applications are responsible for interpreting `retain_until` to determine when an anchor may be soft-deleted (setting `deleted_at`).

## Legal Hold

When `legal_hold = true` on an anchor row:

- A database trigger (`anchors_no_delete_on_legal_hold`) raises an exception if a `DELETE` statement is issued against that row.
- The error code is `23514` (check violation equivalent).
- Soft-deletion (setting `deleted_at`) is still permitted — the legal hold only blocks hard deletion.

### Setting Legal Hold

Only authorized callers (Org Admins or service role) should set `legal_hold = true`. The RLS policy `anchors_update_org_admin` permits this for org admins.

```sql
UPDATE anchors
SET legal_hold = true
WHERE id = '<anchor-id>';
```

### Releasing Legal Hold

Legal hold can only be released by service-role callers (bypassing RLS). This requires explicit authorization outside the application tier.

```sql
-- Service role only
UPDATE anchors
SET legal_hold = false
WHERE id = '<anchor-id>';
```

## Hard Delete Prevention

The trigger definition:

```sql
CREATE OR REPLACE FUNCTION public.prevent_legal_hold_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.legal_hold = true THEN
    RAISE EXCEPTION 'Cannot delete anchor % — legal hold is active', OLD.id
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

This fires `BEFORE DELETE FOR EACH ROW`, making it impossible to bypass via direct SQL on the table.

## Compliance Notes

- All retention changes must emit an `audit_events` row with `action = 'ANCHOR_RETENTION_UPDATED'` or `action = 'ANCHOR_LEGAL_HOLD_SET'`.
- Audit events are themselves immutable (append-only) — see `04_audit_events.md`.
- `retain_until` is advisory at the application layer; the DB does not auto-delete expired anchors.
