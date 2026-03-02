"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database.types";

export interface InviteResult {
  success: boolean;
  linked: boolean;   // true if an existing profile was linked
  error?: string;
}

export async function inviteMember(email: string): Promise<InviteResult> {
  const supabase = await createClient();

  // 1. Verify actor is ORG_ADMIN
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, linked: false, error: "Not authenticated." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actor } = await (supabase as any)
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .maybeSingle() as { data: Pick<Profile, "role" | "org_id"> | null };

  if (!actor || actor.role !== "ORG_ADMIN")
    return { success: false, linked: false, error: "Forbidden." };
  if (!actor.org_id)
    return { success: false, linked: false, error: "No organisation linked to your account." };

  // 2. Normalise email
  const normalised = email.trim().toLowerCase();

  // 3. Look up profile by email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: target } = await (supabase as any)
    .from("profiles")
    .select("id, role, org_id")
    .eq("email", normalised)
    .maybeSingle() as { data: Pick<Profile, "id" | "role" | "org_id"> | null };

  if (!target) {
    // User does not exist yet — mock success for MVP
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_events").insert({
      actor_user_id: user.id,
      actor_role: "ORG_ADMIN",
      action: "MEMBER_INVITED",
      target_table: "profiles",
      target_id: null,
      org_id: actor.org_id,
    });
    return { success: true, linked: false };
  }

  // 4. Guard: do not overwrite an already-set role or cross-org assignment
  if (target.role !== null)
    return { success: false, linked: false, error: "User already has a role assigned." };
  if (target.org_id !== null && target.org_id !== actor.org_id)
    return { success: false, linked: false, error: "User is already linked to another organisation." };

  // 5. Link target profile to this org (only safe because role is still null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from("profiles")
    .update({ org_id: actor.org_id })
    .eq("id", target.id)
    .is("role", null); // extra guard — fail silently if role was set in the meantime

  if (updateErr) return { success: false, linked: false, error: updateErr.message };

  // 6. Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("audit_events").insert({
    actor_user_id: user.id,
    actor_role: "ORG_ADMIN",
    action: "MEMBER_INVITED",
    target_table: "profiles",
    target_id: target.id,
    org_id: actor.org_id,
  });

  return { success: true, linked: true };
}
