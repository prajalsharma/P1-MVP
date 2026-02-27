"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, type FileFingerprint } from "@/lib/fileHasher";
import type { AnchorInsert } from "@/types/database.types";
import styles from "./ConfirmAnchorModal.module.css";

// Common ISO 3166-1 alpha-2 jurisdiction codes
const JURISDICTION_OPTIONS = [
  { value: "", label: "Select jurisdiction (optional)" },
  { value: "US", label: "United States (US)" },
  { value: "US-CA", label: "California, USA (US-CA)" },
  { value: "US-NY", label: "New York, USA (US-NY)" },
  { value: "US-TX", label: "Texas, USA (US-TX)" },
  { value: "US-FL", label: "Florida, USA (US-FL)" },
  { value: "US-DE", label: "Delaware, USA (US-DE)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "GB-ENG", label: "England (GB-ENG)" },
  { value: "DE", label: "Germany (DE)" },
  { value: "FR", label: "France (FR)" },
  { value: "CA", label: "Canada (CA)" },
  { value: "AU", label: "Australia (AU)" },
  { value: "JP", label: "Japan (JP)" },
  { value: "SG", label: "Singapore (SG)" },
  { value: "CH", label: "Switzerland (CH)" },
  { value: "IN", label: "India (IN)" },
  { value: "AE", label: "UAE (AE)" },
];

interface ConfirmAnchorModalProps {
  data: FileFingerprint;
  onSuccess: (anchorId: string) => void;
  onCancel: () => void;
}

export function ConfirmAnchorModal({ data, onSuccess, onCancel }: ConfirmAnchorModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jurisdiction, setJurisdiction] = useState("");

  // Handle Escape key to close modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onCancel();
      }
    },
    [onCancel, submitting]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated.");
      }

      // Only fingerprint + metadata — NEVER raw file bytes
      const insert: AnchorInsert = {
        user_id: user.id,
        file_fingerprint: data.fingerprint,
        file_name: data.file_name,
        file_size_bytes: data.file_size_bytes,
        file_mime: data.file_mime,
        status: "PENDING",
        jurisdiction: jurisdiction || null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error: insertError } = await (supabase as any)
        .from("anchors")
        .insert(insert)
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);

      onSuccess(row.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onCancel();
        }
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id="modal-title" className={styles.title}>
            Confirm Anchor
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.securityNote}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M7 1.75L2.333 3.5v3.5c0 2.9 2.007 5.61 4.667 6.417C9.66 12.61 11.667 9.9 11.667 7V3.5L7 1.75z"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
            File never leaves your device — only the cryptographic fingerprint is stored.
          </div>

          <dl className={styles.meta}>
            <div className={styles.row}>
              <dt className={styles.key}>File name</dt>
              <dd className={styles.val}>{data.file_name}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.key}>File size</dt>
              <dd className={styles.val}>{formatBytes(data.file_size_bytes)}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.key}>MIME type</dt>
              <dd className={styles.val}>{data.file_mime}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.key}>SHA-256</dt>
              <dd className={`${styles.val} ${styles.fingerprint}`}>{data.fingerprint}</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.key}>Status</dt>
              <dd className={styles.val}>
                <span className={styles.statusBadge}>PENDING</span>
              </dd>
            </div>
          </dl>

          {/* Jurisdiction selector */}
          <div className={styles.fieldGroup}>
            <label htmlFor="jurisdiction" className={styles.fieldLabel}>
              Jurisdiction (optional)
            </label>
            <select
              id="jurisdiction"
              className={styles.select}
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              disabled={submitting}
            >
              {JURISDICTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className={styles.fieldHint}>
              Informational only — indicates the legal jurisdiction this document relates to.
            </p>
          </div>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Anchoring…" : "Anchor document"}
          </button>
        </footer>
      </div>
    </div>
  );
}
