"use client";

import { useCallback, useRef, useState } from "react";
import { hashFile, formatBytes } from "@/lib/fileHasher";
import type { Anchor } from "@/types/database.types";
import styles from "./AssetDetailView.module.css";

interface AssetDetailViewProps {
  anchor: Anchor;
}

type VerifyState = "idle" | "hashing" | "match" | "mismatch";

const STATUS_LABELS: Record<Anchor["status"], string> = {
  PENDING: "Pending",
  SECURED: "Secured",
  REVOKED: "Revoked",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUTC(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function AssetDetailView({ anchor }: AssetDetailViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const verificationUrl = typeof window !== "undefined"
    ? `${window.location.origin}/verify/${anchor.public_id}`
    : `/verify/${anchor.public_id}`;

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silently
    }
  }, [verificationUrl]);

  const handleVerify = useCallback(
    async (file: File) => {
      setVerifyState("hashing");
      setVerifyError(null);
      try {
        const { fingerprint } = await hashFile(file);
        setVerifyState(fingerprint === anchor.file_fingerprint ? "match" : "mismatch");
      } catch (err) {
        setVerifyError(err instanceof Error ? err.message : "Failed to hash file.");
        setVerifyState("idle");
      }
    },
    [anchor.file_fingerprint]
  );

  return (
    <div className={styles.card}>
      {/* Certificate header */}
      <div className={styles.certHeader}>
        <div className={styles.certIconWrap}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 2L3 5v5c0 4.14 2.867 8.015 7 9.167C14.133 18.015 17 14.14 17 10V5L10 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M7 10l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h2 className={styles.certTitle}>{anchor.file_name}</h2>
          <p className={styles.certSub}>Arkova Anchor Certificate</p>
        </div>
        <span className={styles.statusBadge} data-status={anchor.status}>
          {STATUS_LABELS[anchor.status]}
        </span>
      </div>

      {/* Metadata */}
      <dl className={styles.meta}>
        <div className={styles.row}>
          <dt className={styles.key}>Anchor ID</dt>
          <dd className={`${styles.val} ${styles.mono}`}>{anchor.id}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.key}>SHA-256 fingerprint</dt>
          <dd className={`${styles.val} ${styles.mono} ${styles.fingerprintText}`}>
            {anchor.file_fingerprint}
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.key}>File size</dt>
          <dd className={styles.val}>{formatBytes(anchor.file_size_bytes)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.key}>MIME type</dt>
          <dd className={styles.val}>{anchor.file_mime}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.key}>Anchored at</dt>
          <dd className={styles.val}>{formatDate(anchor.created_at)}</dd>
        </div>
        {anchor.jurisdiction && (
          <div className={styles.row}>
            <dt className={styles.key}>Jurisdiction</dt>
            <dd className={styles.val}>{anchor.jurisdiction}</dd>
          </div>
        )}
      </dl>

      {/* Public Verification URL */}
      {anchor.public_id && (
        <div className={styles.verifyUrlSection}>
          <div className={styles.verifyUrlHeader}>
            <h3 className={styles.verifySectionTitle}>Public Verification Link</h3>
            <p className={styles.verifySectionDesc}>
              Share this link with third parties to verify this document&apos;s authenticity.
            </p>
          </div>
          <div className={styles.urlRow}>
            <code className={styles.urlText}>{verificationUrl}</code>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopyUrl}
              aria-label={copied ? "Copied" : "Copy URL"}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
                  <path d="M9.5 4.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v5A1.5 1.5 0 0 0 3 9.5h1.5" stroke="currentColor" strokeWidth="1.25" />
                </svg>
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Blockchain Attestation */}
      {anchor.status === "SECURED" && anchor.chain_tx_id && (
        <div className={styles.chainSection}>
          <h3 className={styles.verifySectionTitle}>Blockchain Attestation</h3>
          <dl className={styles.chainMeta}>
            <div className={styles.row}>
              <dt className={styles.key}>Network Receipt</dt>
              <dd className={`${styles.val} ${styles.mono}`}>{anchor.chain_tx_id}</dd>
            </div>
            {anchor.chain_timestamp && (
              <div className={styles.row}>
                <dt className={styles.key}>Anchored (UTC)</dt>
                <dd className={styles.val}>{formatUTC(anchor.chain_timestamp)}</dd>
              </div>
            )}
            {anchor.chain_block_height && (
              <div className={styles.row}>
                <dt className={styles.key}>Block Height</dt>
                <dd className={styles.val}>{anchor.chain_block_height.toLocaleString()}</dd>
              </div>
            )}
            {anchor.chain_network && (
              <div className={styles.row}>
                <dt className={styles.key}>Network</dt>
                <dd className={styles.val}>{anchor.chain_network}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Re-verify section */}
      <div className={styles.verifySection}>
        <div className={styles.verifySectionHeader}>
          <h3 className={styles.verifySectionTitle}>Re-verify document</h3>
          <p className={styles.verifySectionDesc}>
            Select the original file — it will be hashed locally and compared to the stored
            fingerprint. No data leaves your device.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          aria-label="Select file to verify"
          className={styles.hiddenInput}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleVerify(file);
            // reset input so same file can be re-selected
            e.target.value = "";
          }}
        />

        {verifyState === "idle" && (
          <button
            type="button"
            className={styles.verifyBtn}
            onClick={() => inputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.25" />
              <path
                d="M5 7l1.5 1.5L9 5.5"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Select file to verify
          </button>
        )}

        {verifyState === "hashing" && (
          <p className={styles.verifyHashing}>Computing fingerprint…</p>
        )}

        {verifyState === "match" && (
          <div className={styles.verifyResult} data-result="match" role="status">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M5.5 9l2.5 2.5L12.5 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className={styles.verifyResultTitle}>Fingerprint match</p>
              <p className={styles.verifyResultSub}>
                This file matches the anchored fingerprint exactly.
              </p>
            </div>
            <button
              type="button"
              className={styles.verifyAgainBtn}
              onClick={() => {
                setVerifyState("idle");
                setVerifyError(null);
              }}
            >
              Verify again
            </button>
          </div>
        )}

        {verifyState === "mismatch" && (
          <div className={styles.verifyResult} data-result="mismatch" role="alert">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M6 6l6 6M12 6l-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <p className={styles.verifyResultTitle}>Fingerprint mismatch</p>
              <p className={styles.verifyResultSub}>
                The file you selected does not match the anchored fingerprint. The document may have
                been modified.
              </p>
            </div>
            <button
              type="button"
              className={styles.verifyAgainBtn}
              onClick={() => {
                setVerifyState("idle");
                setVerifyError(null);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {verifyError && (
          <p className={styles.verifyError} role="alert">
            {verifyError}
          </p>
        )}
      </div>
    </div>
  );
}
