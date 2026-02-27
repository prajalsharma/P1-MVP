import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/vault/DashboardLayout";
import { OrgRegistryTable } from "@/components/org/OrgRegistryTable";
import type { Profile, Anchor } from "@/types/database.types";
import styles from "./registry.module.css";

export const metadata = {
  title: "Registry — Arkova",
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}

export default async function OrgRegistryPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  // ── Auth + role guard ────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  // ── Pagination + filter params ───────────────────────────────────────────
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const status = params.status ?? "";
  const search = params.search ?? "";
  const offset = (page - 1) * PAGE_SIZE;

  // ── Build query ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("anchors")
    .select("*", { count: "exact" })
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status && ["PENDING", "SECURED", "REVOKED"].includes(status)) {
    query = query.eq("status", status);
  }

  if (search) {
    // Sanitize search input to prevent SQL injection
    const sanitized = search.replace(/[%_'"\\]/g, "");
    if (sanitized.length > 0) {
      query = query.or(`file_name.ilike.%${sanitized}%,id.ilike.${sanitized}%`);
    }
  }

  const { data: anchors, count } = await query as {
    data: Anchor[] | null;
    count: number | null;
  };

  return (
    <DashboardLayout profile={profile} activeNav="registry">
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h2 className={styles.pageTitle}>Organisation registry</h2>
            <p className={styles.pageDesc}>
              All anchors submitted under your organisation. RLS enforces org scoping.
            </p>
          </div>
        </div>

        <OrgRegistryTable
          anchors={anchors ?? []}
          total={count ?? 0}
          page={page}
          status={status}
          search={search}
          orgId={profile.org_id}
        />
      </div>
    </DashboardLayout>
  );
}
