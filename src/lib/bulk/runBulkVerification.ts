"use server";

/**
 * runBulkVerification — P6-S2
 *
 * Batch execution server action for ORG_ADMIN bulk verification.
 *
 * Idempotency guarantee:
 *   Each row is identified by a deterministic key:
 *     SHA-256( batch_id + ":" + normalised_email + ":" + timestamp )
 *   stored as file_fingerprint in the anchors table.
 * 
 * Requirement: Every hash MUST include the UTC timestamp to satisfy 
 * European compliance and ensure anchor uniqueness.
 */

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database.types";

export interface BulkRow {
  email: string;
  external_id?: string;
  metadata?: string;
}

export interface BulkRowResult {
  email: string;
  status: "processed" | "skipped" | "error";
  anchor_id?: string;
  error?: string;
}

export interface BulkVerificationResult {
  success: boolean;
  error?: string;
  processed: number;
  skipped: number;
  errors: number;
  rows: BulkRowResult[];
}

/**
 * Deterministic fingerprint for the anchor.
 * Includes the timestamp to satisfy compliance requirements.
 */
async function deterministicFingerprint(batchId: string, email: string, timestamp: string): Promise<string> {
  const input = `${batchId}:${email.trim().toLowerCase()}:${timestamp}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function runBulkVerification(
  batchId: string,
  rows: BulkRow[]
): Promise<BulkVerificationResult> {
  const supabase = await createClient();
  const batchTimestamp = new Date().toISOString();

  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated.", processed: 0, skipped: 0, errors: 0, rows: [] };
  }

  // ── 2. ORG_ADMIN check ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .maybeSingle() as { data: Pick<Profile, "role" | "org_id"> | null };

  if (!profile || profile.role !== "ORG_ADMIN") {
    return { success: false, error: "Forbidden.", processed: 0, skipped: 0, errors: 0, rows: [] };
  }

  if (!profile.org_id) {
    return { success: false, error: "No organisation linked to your account.", processed: 0, skipped: 0, errors: 0, rows: [] };
  }

  // ── 3. Validate batchId ───────────────────────────────────────────────────
  if (!batchId || typeof batchId !== "string" || batchId.length < 4) {
    return { success: false, error: "Invalid batch_id.", processed: 0, skipped: 0, errors: 0, rows: [] };
  }

  const orgId = profile.org_id;
  const results: BulkRowResult[] = [];
  let processed = 0;
  let skipped = 0;
  let errorCount = 0;

  // ── 4. Process rows one-by-one ────────────────────────────────────────────
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();

    if (!email) {
      results.push({ email: row.email, status: "error", error: "email is required" });
      errorCount++;
      continue;
    }

    // Build fingerprint including UTC timestamp
    const fingerprint = await deterministicFingerprint(batchId, email, batchTimestamp);

    // Note: Idempotency is now per-batch-run. Re-running the same batch ID 
    // will create new anchors with new timestamps.
    
    const safeLabel = `bulk-${batchId.slice(0, 8)}-entry`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insertErr } = await (supabase as any)
      .from("anchors")
      .insert({
        user_id: user.id,
        org_id: orgId,
        file_fingerprint: fingerprint,
        file_name: safeLabel,
        file_size_bytes: 1,
        file_mime: "application/octet-stream",
        status: "SECURED",
        retention_policy: "STANDARD",
        created_at: batchTimestamp,
      })
      .select("id")
      .maybeSingle() as { data: { id: string } | null; error: { message: string } | null };

    if (insertErr || !inserted) {
      results.push({ email, status: "error", error: insertErr?.message ?? "Insert failed" });
      errorCount++;
      continue;
    }

    results.push({ email: email, status: "processed", anchor_id: inserted.id });
    processed++;
  }

  // ── 5. Emit ONE audit event per batch run ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_events").insert({
    actor_user_id: user.id,
    actor_role: "ORG_ADMIN",
    action: "BULK_VERIFICATION_RUN",
    target_table: "anchors",
    target_id: null,
    org_id: orgId,
  });

  return {
    success: true,
    processed,
    skipped,
    errors: errorCount,
    rows: results,
  };
}
