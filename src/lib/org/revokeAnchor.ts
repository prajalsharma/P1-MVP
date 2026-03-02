"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Anchor } from "@/types/database.types";

export interface RevokeResult {
  success: boolean;
  error?: string;
}

export async function revokeAnchor(anchorId: string): Promise<RevokeResult> {
  const supabase = await createClient();

  // 1. Verify session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated." };

  // 2. Fetch actor profile — confirms role = ORG_ADMIN and captures org_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileErr } = await (supabase as any)
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .maybeSingle() as { data: Pick<Profile, "role" | "org_id"> | null; error: unknown };

  if (profileErr || !profile) return { success: false, error: "Profile not found." };
  if (profile.role !== "ORG_ADMIN") return { success: false, error: "Forbidden." };
  if (!profile.org_id) return { success: false, error: "No organisation linked to your account." };

  // 3. Fetch the anchor — confirm it belongs to this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: anchor, error: anchorErr } = await (supabase as any)
    .from("anchors")
    .select("id, org_id, status")
    .eq("id", anchorId)
    .maybeSingle() as { data: Pick<Anchor, "id" | "org_id" | "status"> | null; error: unknown };

  if (anchorErr || !anchor) return { success: false, error: "Anchor not found." };
  if (anchor.org_id !== profile.org_id) return { success: false, error: "Forbidden." };
  if (anchor.status === "REVOKED") return { success: false, error: "Anchor is already revoked." };

  // 4. Update status to REVOKED
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from("anchors")
    .update({ status: "REVOKED" })
    .eq("id", anchorId)
    .eq("org_id", profile.org_id); // double-bound to org

  if (updateErr) return { success: false, error: updateErr.message };

  // 5. Emit audit event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("audit_events")
    .insert({
      actor_user_id: user.id,
      actor_role: "ORG_ADMIN",
      action: "ANCHOR_REVOKED",
      target_table: "anchors",
      target_id: anchorId,
      org_id: profile.org_id,
    });

  return { success: true };
}
