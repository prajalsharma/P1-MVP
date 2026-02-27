import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoleSelectionForm } from "./RoleSelectionForm";
import type { Profile } from "@/types/database.types";

export const metadata = {
  title: "Choose your role — Arkova",
};

export default async function RoleSelectionPage() {
  const supabase = await createClient();

  // ── Auth guard (defense-in-depth, middleware also protects) ─────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If user already has a role, redirect to vault
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle() as { data: Pick<Profile, "role"> | null };

  if (profile?.role) {
    redirect("/vault");
  }

  return <RoleSelectionForm />;
}
