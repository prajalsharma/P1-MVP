import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgOnboardingForm } from "./OrgOnboardingForm";
import type { Profile } from "@/types/database.types";

export const metadata = {
  title: "Register organisation — Arkova",
};

export default async function OrgOnboardingPage() {
  const supabase = await createClient();

  // ── Auth guard (defense-in-depth, middleware also protects) ─────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If user already completed onboarding, redirect appropriately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, onboarding_completed_at, requires_manual_review")
    .eq("id", user.id)
    .maybeSingle() as { data: Pick<Profile, "role" | "onboarding_completed_at" | "requires_manual_review"> | null };

  if (profile?.onboarding_completed_at) {
    redirect("/vault");
  }

  if (profile?.requires_manual_review) {
    redirect("/org/pending-review");
  }

  return <OrgOnboardingForm />;
}
