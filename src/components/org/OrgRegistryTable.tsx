"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Anchor } from "@/types/database.types";
import { revokeAnchor } from "@/lib/org/revokeAnchor";
import { buildRegistryCSV, downloadCSV } from "@/lib/org/exportRegistryToCSV";
import { InviteMemberModal } from "./InviteMemberModal";
import styles from "./OrgRegistryTable.module.css";

const PAGE_SIZE = 20;

interface OrgRegistryTableProps {
  anchors: Anchor[];
  total: number;
  page: number;
  status: string;
  search: string;
  orgId: string;
}

const STATUS_OPTIONS = ["", "PENDING", "SECURED", "REVOKED"] as const;

function truncate(str: string, len: number) {
  if (str.length <= len) return str;
  return str.slice(0, len) + "…";
}

function formatUTC(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function OrgRegistryTable({
  anchors,
  total,
  page,
  status,
  search,
  orgId,
}: OrgRegistryTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Optimistic revoke state — track revoked IDs locally until refresh
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Navigation helpers ────────────────────────────────────────────────────

  function buildHref(overrides: { page?: number; status?: string; search?: string }) {
    const params = new URLSearchParams();
    const p = overrides.page ?? page;
    const s = overrides.status ?? status;
    const q = overrides.search ?? search;
    if (p > 1) params.set("page", String(p));
    if (s) params.set("status", s);
    if (q) params.set("search", q);
    const qs = params.toString();
    return `/org/registry${qs ? "?" + qs : ""}`;
  }

  function navigate(overrides: { page?: number; status?: string; search?: string }) {
    startTransition(() => router.push(buildHref(overrides)));
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  async function handleRevoke(anchorId: string) {
    setRevokeLoading(true);
    setRevokeError(null);

    const result = await revokeAnchor(anchorId);

    if (result.success) {
      setRevokedIds((prev) => new Set([...prev, anchorId]));
      setConfirmingId(null);
      startTransition(() => router.refresh());
    } else {
      setRevokeError(result.error ?? "Failed to revoke anchor.");
    }
    setRevokeLoading(false);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      // Fetch ALL org anchors for export (no pagination) via fetch to the same page route
      const params = new URLSearchParams({ export: "1", status, search });
      const res = await fetch(`/api/org/registry/export?${params}`);
      if (!res.ok) throw new Error("Export failed.");
      const allAnchors: Anchor[] = await res.json();
      const csv = buildRegistryCSV(allAnchors);
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `arkova-registry-${date}.csv`);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExportLoading(false);
    }
  }, [status, search]);

  // ── Search ────────────────────────────────────────────────────────────────

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("search") as HTMLInputElement).value.trim();
    navigate({ search: q, page: 1 });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const rows = anchors.map((a) => ({
    ...a,
    effectiveStatus: revokedIds.has(a.id) ? ("REVOKED" as const) : a.status,
  }));

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <input
            name="search"
            type="search"
            className={styles.searchInput}
            placeholder="Search file name or anchor ID…"
            defaultValue={search}
            aria-label="Search registry"
          />
          <button type="submit" className={styles.searchBtn} disabled={isPending}>
            Search
          </button>
        </form>

        <div className={styles.toolbarRight}>
          <select
            className={styles.statusFilter}
            value={status}
            onChange={(e) => navigate({ status: e.target.value, page: 1 })}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.inviteBtn}
            onClick={() => setShowInvite(true)}
          >
            Invite member
          </button>

          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={exportLoading}
          >
            {exportLoading ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {revokeError && (
        <p className={styles.errorBanner} role="alert">
          {revokeError}
          <button
            type="button"
            className={styles.dismissError}
            onClick={() => setRevokeError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Anchor ID</th>
              <th className={styles.th}>File name</th>
              <th className={styles.th}>SHA-256 fingerprint</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Created (UTC)</th>
              <th className={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No anchors found.
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id} className={styles.tr}>
                  <td className={`${styles.td} ${styles.mono}`} title={a.id}>
                    {truncate(a.id, 18)}
                  </td>
                  <td className={styles.td} title={a.file_name}>
                    {truncate(a.file_name, 32)}
                  </td>
                  <td
                    className={`${styles.td} ${styles.mono} ${styles.fingerprint}`}
                    title={a.file_fingerprint}
                  >
                    {truncate(a.file_fingerprint, 20)}
                  </td>
                  <td className={styles.td}>
                    <span
                      className={styles.statusBadge}
                      data-status={a.effectiveStatus}
                    >
                      {a.effectiveStatus}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.dateCell}`}>
                    {formatUTC(a.created_at)}
                  </td>
                  <td className={styles.td}>
                    {a.effectiveStatus !== "REVOKED" ? (
                      confirmingId === a.id ? (
                        <span className={styles.confirmInline}>
                          <span className={styles.confirmText}>Revoke?</span>
                          <button
                            type="button"
                            className={styles.confirmYes}
                            onClick={() => handleRevoke(a.id)}
                            disabled={revokeLoading}
                          >
                            {revokeLoading ? "…" : "Yes"}
                          </button>
                          <button
                            type="button"
                            className={styles.confirmNo}
                            onClick={() => setConfirmingId(null)}
                            disabled={revokeLoading}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.revokeBtn}
                          onClick={() => setConfirmingId(a.id)}
                        >
                          Revoke
                        </button>
                      )
                    ) : (
                      <span className={styles.revokedLabel}>Revoked</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className={styles.pagination} aria-label="Pagination">
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page <= 1 || isPending}
          onClick={() => navigate({ page: page - 1 })}
        >
          Previous
        </button>
        <span className={styles.pageInfo}>
          Page {page} of {totalPages} &mdash; {total} total
        </span>
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page >= totalPages || isPending}
          onClick={() => navigate({ page: page + 1 })}
        >
          Next
        </button>
      </div>

      {showInvite && (
        <InviteMemberModal onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}
