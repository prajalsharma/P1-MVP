# Data Model

## Overview

Arkova's data model is built on four core tables backed by two canonical enum types.

## Enum Types

### `user_role`

| Value | Meaning |
|-------|---------|
| `INDIVIDUAL` | A standalone user with no org affiliation |
| `ORG_ADMIN` | An administrator of an organization |

### `anchor_status`

| Value | Meaning |
|-------|---------|
| `PENDING` | Fingerprint submitted, not yet confirmed |
| `SECURED` | Fingerprint anchored and verified |
| `REVOKED` | Anchor invalidated |

## Tables

### `organizations`

Represents a verified legal entity.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `legal_name` | TEXT | Required, 1–255 chars |
| `display_name` | TEXT | Required, 1–255 chars |
| `domain` | TEXT | Nullable, unique, validated hostname |
| `verification_status` | TEXT | `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED` |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

### `profiles`

One row per `auth.users` entry. Auth-linked.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | = `auth.users.id` |
| `email` | TEXT | Normalized: `lower(trim(email))` |
| `role` | `user_role` | Nullable. Immutable once set (see 0005) |
| `is_public` | BOOLEAN | Defaults false |
| `org_id` | UUID FK | Nullable, references `organizations` |
| `requires_manual_review` | BOOLEAN | Flags for compliance review |
| `manual_review_reason` | TEXT | Nullable, max 1000 chars |
| `role_set_at` | TIMESTAMPTZ | Auto-set when role first assigned |
| `onboarding_completed_at` | TIMESTAMPTZ | Nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto-managed |

### `anchors`

Fingerprint-only evidence records. **No raw file content is stored.**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `user_id` | UUID FK | References `profiles.id` |
| `org_id` | UUID FK | Nullable, references `organizations` |
| `public_id` | TEXT | Unique, non-guessable ID for public verification |
| `file_fingerprint` | TEXT | SHA-256 hex, exactly 64 chars, validated by regex |
| `file_name` | TEXT | 1–255 chars, email-format rejected |
| `file_size_bytes` | BIGINT | 1 byte – 5 GiB |
| `file_mime` | TEXT | Validated MIME format |
| `status` | `anchor_status` | Defaults `PENDING` |
| `jurisdiction` | TEXT | Optional, ISO 3166-1 alpha-2, customer-asserted |
| `retention_policy` | TEXT | Defaults `STANDARD` |
| `retain_until` | TIMESTAMPTZ | Nullable |
| `legal_hold` | BOOLEAN | If `true`, hard delete is blocked by trigger |
| `chain_tx_id` | TEXT | Network Receipt (blockchain hash) |
| `chain_timestamp` | TIMESTAMPTZ | Observed Time (UTC) |
| `chain_block_height` | BIGINT | Block height if present |
| `chain_network` | TEXT | Default 'ethereum' |
| `deleted_at` | TIMESTAMPTZ | Soft-delete marker |
| `created_at` | TIMESTAMPTZ | Auto-set |

### `anchor_events`

Lifecycle tracking for the verification timeline.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `anchor_id` | UUID FK | References `anchors.id` |
| `event_type` | TEXT | e.g. `CREATED`, `STATUS_CHANGED` |
| `occurred_at` | TIMESTAMPTZ | Defaults to `now()` |
| `actor_user_id` | UUID FK | References `profiles.id` |
| `metadata` | JSONB | Event-specific data |

### `audit_events`

Append-only compliance log. UPDATE and DELETE are blocked at DB level by triggers.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `occurred_at` | TIMESTAMPTZ | Auto-set |
| `actor_user_id` | UUID FK | Nullable, references `profiles` |
| `actor_role` | `user_role` | Nullable |
| `action` | TEXT | 1–128 chars |
| `target_table` | TEXT | 1–64 chars |
| `target_id` | UUID | Nullable |
| `org_id` | UUID FK | Nullable, references `organizations` |

## Invariants

1. `profiles.role` can only transition `NULL → value`. Enforced by trigger `profiles_role_immutability`.
2. `anchors.legal_hold = true` blocks hard deletion. Enforced by trigger `anchors_no_delete_on_legal_hold`.
3. `audit_events` rows are permanent. No UPDATE or DELETE is possible at the application layer.
4. `profiles.email` is normalized to `lower(trim(email))` via CHECK constraint.
5. `anchors.file_fingerprint` must match `^[0-9a-f]{64}$` (SHA-256 hex only).
