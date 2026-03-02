import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/vault/DashboardLayout";
import { BulkWizard } from "@/components/bulk/BulkWizard";
import type { Profile } from "@/types/database.types";

export const metadata = {
  title: "Bulk Verification — Arkova",
};

export default async function BulkPage() {
  const supabase = await createClient();

  // ── Auth guard ───────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── Role guard ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle() as { data: Profile | null };

  if (!profile || profile.role !== "ORG_ADMIN") redirect("/vault");
  if (profile.requires_manual_review) redirect("/org/pending-review");
  if (!profile.onboarding_completed_at) redirect("/onboarding/org");
  if (!profile.org_id) redirect("/vault");

  return (
    <DashboardLayout profile={profile} activeNav="bulk">
      <BulkWizard />
    </DashboardLayout>
  );
}
