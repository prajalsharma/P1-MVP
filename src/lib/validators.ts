/**
 * Zod validators for Arkova domain objects.
 *
 * Enforces:
 *  - No raw PII in anchor fields (file_name must not look like email/SSN)
 *  - file_mime must be a valid MIME type string
 *  - file_fingerprint must be a 64-char hex SHA-256
 *  - role is one of the two canonical values
 *  - All required fields are present
 */

import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const UserRoleSchema = z.enum(["INDIVIDUAL", "ORG_ADMIN"]);
export const AnchorStatusSchema = z.enum(["PENDING", "SECURED", "REVOKED"]);

// ─── Anti-PII helpers ─────────────────────────────────────────────────────────

/** Reject strings that look like email addresses. */
const NO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reject strings that look like US SSNs (ddd-dd-dddd or ddddddddd). */
const NO_SSN = /^\d{3}-\d{2}-\d{4}$|^\d{9}$/;

/** SHA-256 hex fingerprint — exactly 64 hex chars. */
const SHA256_HEX = /^[0-9a-f]{64}$/i;

/** Loose MIME type check: type/subtype optionally with parameters. */
const MIME_RE = /^[a-z][a-z0-9!#$&^_-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,62}(;\s*.+=.+)*$/i;

function noRawPii(fieldName: string) {
  return z
    .string()
    .min(1, `${fieldName} is required`)
    .max(255, `${fieldName} must be ≤255 chars`)
    .refine((v) => !NO_EMAIL.test(v), {
      message: `${fieldName} must not contain an email address`,
    })
    .refine((v) => !NO_SSN.test(v), {
      message: `${fieldName} must not contain an SSN`,
    });
}

// ─── Anchor ───────────────────────────────────────────────────────────────────

export const AnchorInsertSchema = z.object({
  user_id: z.string().uuid("user_id must be a valid UUID"),
  org_id: z.string().uuid("org_id must be a valid UUID").nullable().optional(),
  file_fingerprint: z
    .string()
    .regex(SHA256_HEX, "file_fingerprint must be a 64-char hex SHA-256"),
  file_name: noRawPii("file_name"),
  file_size_bytes: z
    .number()
    .int("file_size_bytes must be an integer")
    .positive("file_size_bytes must be positive")
    .max(5_368_709_120, "file_size_bytes must be ≤5 GiB"),
  file_mime: z
    .string()
    .regex(MIME_RE, "file_mime must be a valid MIME type (e.g. application/pdf)"),
  status: AnchorStatusSchema.optional().default("PENDING"),
  retention_policy: z.string().max(64).optional().default("STANDARD"),
    retain_until: z.string().datetime().nullable().optional(),
    legal_hold: z.boolean().optional().default(false),
    jurisdiction: z
      .string()
      .regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/, "jurisdiction must be a valid ISO 3166-1 alpha-2 code with optional subdivision (e.g. US, US-CA)")
      .nullable()
      .optional(),
  });

export type AnchorInsertInput = z.infer<typeof AnchorInsertSchema>;

// ─── Profile ──────────────────────────────────────────────────────────────────

export const ProfileInsertSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  email: z.string().email("email must be valid"),
  role: UserRoleSchema.nullable().optional(),
  is_public: z.boolean().optional().default(false),
  org_id: z.string().uuid("org_id must be a valid UUID").nullable().optional(),
});

export type ProfileInsertInput = z.infer<typeof ProfileInsertSchema>;

export const ProfileUpdateSchema = z.object({
  is_public: z.boolean().optional(),
  onboarding_completed_at: z.string().datetime().nullable().optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// ─── Organization ─────────────────────────────────────────────────────────────

export const OrganizationInsertSchema = z.object({
  legal_name: z.string().min(1).max(255),
  display_name: z.string().min(1).max(255),
  domain: z
    .string()
    .max(253)
    .regex(
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i,
      "domain must be a valid hostname"
    )
    .nullable()
    .optional(),
});

export type OrganizationInsertInput = z.infer<typeof OrganizationInsertSchema>;

// ─── Audit event ──────────────────────────────────────────────────────────────

export const AuditEventInsertSchema = z.object({
  actor_user_id: z.string().uuid().nullable().optional(),
  actor_role: UserRoleSchema.nullable().optional(),
  action: z.string().min(1).max(128),
  target_table: z.string().min(1).max(64),
  target_id: z.string().uuid().nullable().optional(),
  org_id: z.string().uuid().nullable().optional(),
});

export type AuditEventInsertInput = z.infer<typeof AuditEventInsertSchema>;
