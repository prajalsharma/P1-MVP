"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Anchor } from "@/types/database.types";
import { formatBytes } from "@/lib/fileHasher";
import styles from "./AnchorList.module.css";

const PAGE_SIZE = 10;

interface AnchorListProps {
  anchors: Anchor[];
  total: number;
  page: number;
}

const STATUS_COLORS: Record<Anchor["status"], string> = {
  PENDING: "pending",
  SECURED: "secured",
  REVOKED: "revoked",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(str: string, len: number) {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

export function AnchorList({ anchors, total, page }: AnchorListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function navigate(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    router.push(`/vault${qs ? "?" + qs : ""}`);
  }

  if (total === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className={styles.emptyText}>No anchors yet</p>
        <p className={styles.emptySubtext}>
          Drop a file above to create your first anchor.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.listHeader}>
        <span className={styles.listCount}>
          {total} anchor{total !== 1 ? "s" : ""}
        </span>
      </div>

      <ul className={styles.list}>
        {anchors.map((anchor) => (
          <li key={anchor.id} className={styles.item}>
            <Link href={`/anchors/${anchor.id}`} className={styles.itemLink}>
              <div className={styles.itemMain}>
                <div className={styles.itemIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 2L3 4.5v4c0 2.76 2.015 5.35 5 6.167 2.985-.817 5-3.407 5-6.167v-4L8 2z"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className={styles.itemDetails}>
                  <span className={styles.itemName} title={anchor.file_name}>
                    {truncate(anchor.file_name, 40)}
                  </span>
                  <span className={styles.itemMeta}>
                    {formatBytes(anchor.file_size_bytes)} &middot; {formatDate(anchor.created_at)}
                  </span>
                </div>
              </div>
              <div className={styles.itemRight}>
                <span
                  className={styles.statusBadge}
                  data-status={STATUS_COLORS[anchor.status]}
                >
                  {anchor.status}
                </span>
                <svg
                  className={styles.chevron}
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => navigate(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M9 3L5 7l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => navigate(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            Next
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
