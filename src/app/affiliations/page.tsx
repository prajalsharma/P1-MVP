import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/vault/DashboardLayout";
import { AffiliationsEmptyState } from "@/components/affiliations/AffiliationsEmptyState";
import type { Profile } from "@/types/database.types";

export const metadata = {
  title: "Affiliations — Arkova",
};

export default async function AffiliationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding/role");
  }

  return (
    <DashboardLayout profile={profile as Profile} activeNav="affiliations">
      <AffiliationsEmptyState />
    </DashboardLayout>
  );
}
