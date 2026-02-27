import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/vault/DashboardLayout";
import { PrivacyToggle } from "@/components/vault/PrivacyToggle";
import { AnchorSection } from "@/components/anchor/AnchorSection";
import { AnchorList } from "@/components/anchor/AnchorList";
import type { Profile, Anchor } from "@/types/database.types";
import styles from "./vault.module.css";

export const metadata = {
  title: "Vault — Arkova",
};

const PAGE_SIZE = 10;

interface VaultPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function VaultPage({ searchParams }: VaultPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // user is defined past this point; redirect() throws so TS needs the assertion
  const authedUser = user!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", authedUser.id)
    .maybeSingle() as { data: Profile | null };

  if (!profile || !profile.role) {
    redirect("/onboarding/role");
  }

  // Fetch anchors with pagination — scope by role
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let anchorQuery = (supabase as any)
    .from("anchors")
    .select("*", { count: "exact" })
    .in("status", ["PENDING", "SECURED"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (profile.role === "ORG_ADMIN" && profile.org_id) {
      // ORG_ADMIN sees org anchors AND their own anchors (covers anchors
      // created before org_id was set on the profile)
      anchorQuery = anchorQuery.or(
        `org_id.eq.${profile.org_id},user_id.eq.${authedUser.id}`
      );
    } else {
      // INDIVIDUAL sees only their own anchors
      anchorQuery = anchorQuery.eq("user_id", authedUser.id);
    }

  const { data: anchors, count } = await anchorQuery as { data: Anchor[] | null; count: number | null };

  return (
    <DashboardLayout profile={profile as Profile}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Profile settings</h2>
          <p className={styles.sectionDesc}>
            Control who can view your profile and credentials.
          </p>
        </div>
        <PrivacyToggle />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Anchor a document</h2>
          <p className={styles.sectionDesc}>
            Compute a cryptographic fingerprint of any file. The file never leaves your device.
          </p>
        </div>
        <AnchorSection />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Your anchors</h2>
          <p className={styles.sectionDesc}>
            Documents you have anchored with cryptographic fingerprints.
          </p>
        </div>
        <AnchorList anchors={anchors ?? []} total={count ?? 0} page={page} />
      </div>
    </DashboardLayout>
  );
}
