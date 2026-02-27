import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AssetDetailView } from "@/components/anchor/AssetDetailView";
import type { Anchor } from "@/types/database.types";
import type { Metadata } from "next";
import styles from "./anchor-detail.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Anchor ${id.slice(0, 8)}… — Arkova` };
}

export default async function AnchorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: anchor, error } = await (supabase as any)
    .from("anchors")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle() as { data: Anchor | null; error: { message: string } | null };

  if (error || !anchor) {
    notFound();
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header with back button */}
        <header className={styles.header}>
          <Link href="/vault" className={styles.backBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 4L6 8l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Vault
          </Link>
        </header>

        {/* Breadcrumb */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/vault" className={styles.breadcrumbLink}>
            Vault
          </Link>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className={styles.breadcrumbSep}
          >
            <path
              d="M4.5 3l3 3-3 3"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.breadcrumbCurrent}>{anchor.file_name}</span>
        </nav>

        <AssetDetailView anchor={anchor} />
      </div>
    </div>
  );
}
