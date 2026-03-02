import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database.types";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await (supabase
    .from("profiles")
    .select("role, requires_manual_review, onboarding_completed_at")
    .eq("id", user.id)
    .single() as unknown as Promise<{
    data: Pick<Profile, "role" | "requires_manual_review" | "onboarding_completed_at"> | null;
    error: unknown;
  }>);

  if (!profile || profile.role === null) {
    redirect("/onboarding/role");
  }

  if (profile.role === "INDIVIDUAL") {
    redirect("/vault");
  }

  if (profile.role === "ORG_ADMIN") {
    if (profile.requires_manual_review) {
      redirect("/org/pending-review");
    }
    if (!profile.onboarding_completed_at) {
      redirect("/onboarding/org");
    }
    redirect("/vault");
  }

  redirect("/login");
}
