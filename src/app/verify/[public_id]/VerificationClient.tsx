"use client";

/**
 * P6-S1: Public Verification Client Component
 *
 * - Displays credential summary
 * - Shows current status (visually dominant)
 * - Client-side fingerprint verification (no file bytes transmitted)
 * - Lifecycle timeline with UTC timestamps
 * - Anchor proof (blockchain attestation)
 */

import { useState, useCallback } from "react";
import type { PublicVerificationResult, AnchorStatus } from "@/types/database.types";
import styles from "./verify.module.css";

interface VerificationClientProps {
  data: PublicVerificationResult;
}

type VerifyState = "idle" | "verifying" | "match" | "mismatch";

function formatUTC(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function StatusBadge({ status }: { status: AnchorStatus }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {status}
    </span>
  );
}

export function VerificationClient({ data }: VerificationClientProps) {
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifiedFingerprint, setVerifiedFingerprint] = useState<string | null>(null);

  const handleFileVerify = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setVerifyState("verifying");

      try {
        // Client-side SHA-256 hashing - NO file bytes are transmitted
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        setVerifiedFingerprint(fingerprint);

        if (fingerprint.toLowerCase() === data.file_fingerprint?.toLowerCase()) {
          setVerifyState("match");
        } else {
          setVerifyState("mismatch");
        }
      } catch {
        setVerifyState("idle");
      }

      // Reset file input
      e.target.value = "";
    },
    [data.file_fingerprint]
  );

  const resetVerification = () => {
    setVerifyState("idle");
    setVerifiedFingerprint(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoDot} />
            <span className={styles.logoText}>Arkova</span>
          </div>
          <span className={styles.headerTag}>Public Verification</span>
        </header>

        {/* Status Section - Visually Dominant */}
        <section className={styles.statusSection}>
          <StatusBadge status={data.status!} />
          <h1 className={styles.statusTitle}>
            {data.status === "SECURED" && "This record is verified"}
            {data.status === "PENDING" && "This record is pending verification"}
            {data.status === "REVOKED" && "This record has been revoked"}
          </h1>
        </section>

        {/* Credential Summary */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Credential Summary</h2>
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt className={styles.detailLabel}>Document</dt>
              <dd className={styles.detailValue}>{data.file_name}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailLabel}>Issuer</dt>
              <dd className={styles.detailValue}>{data.issuer_name}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt className={styles.detailLabel}>Anchored</dt>
              <dd className={styles.detailValue}>{data.created_at && formatUTC(data.created_at)}</dd>
            </div>
            {data.jurisdiction && (
              <div className={styles.detailRow}>
                <dt className={styles.detailLabel}>Jurisdiction</dt>
                <dd className={styles.detailValue}>{data.jurisdiction}</dd>
              </div>
            )}
            <div className={styles.detailRow}>
              <dt className={styles.detailLabel}>SHA-256 Fingerprint</dt>
              <dd className={`${styles.detailValue} ${styles.mono}`}>{data.file_fingerprint}</dd>
            </div>
          </dl>
        </section>

        {/* Fingerprint Verification */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Verify Your Document</h2>
          <p className={styles.cardDesc}>
            Upload your document to verify its fingerprint matches the anchored record.
            <strong> Your file never leaves your device</strong> — only the cryptographic hash is computed locally.
          </p>

          {verifyState === "idle" && (
            <label className={styles.uploadLabel}>
              <input
                type="file"
                className={styles.uploadInput}
                onChange={handleFileVerify}
                accept="*/*"
              />
              <span className={styles.uploadBtn}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M10 4v12M4 10h12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Select file to verify
              </span>
            </label>
          )}

          {verifyState === "verifying" && (
            <div className={styles.verifyLoading}>
              <div className={styles.spinner} />
              <span>Computing fingerprint…</span>
            </div>
          )}

          {verifyState === "match" && (
            <div className={styles.verifyResult} data-result="match">
              <div className={styles.verifyIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                  <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className={styles.verifyTitle}>Fingerprint Match</p>
              <p className={styles.verifyDesc}>
                This document matches the anchored record exactly.
              </p>
              <button className={styles.verifyAgainBtn} onClick={resetVerification}>
                Verify another file
              </button>
            </div>
          )}

          {verifyState === "mismatch" && (
            <div className={styles.verifyResult} data-result="mismatch">
              <div className={styles.verifyIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                  <path d="M11 11l10 10M21 11l-10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <p className={styles.verifyTitle}>Fingerprint Mismatch</p>
              <p className={styles.verifyDesc}>
                This document does not match the anchored record. It may have been modified.
              </p>
              {verifiedFingerprint && (
                <div className={styles.mismatchDetails}>
                  <p><strong>Your file:</strong></p>
                  <code className={styles.mono}>{verifiedFingerprint}</code>
                  <p><strong>Anchored:</strong></p>
                  <code className={styles.mono}>{data.file_fingerprint}</code>
                </div>
              )}
              <button className={styles.verifyAgainBtn} onClick={resetVerification}>
                Try another file
              </button>
            </div>
          )}
        </section>

        {/* Lifecycle Timeline */}
        {data.events && data.events.length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Lifecycle Timeline</h2>
            <ol className={styles.timeline}>
              {data.events.map((event, idx) => (
                <li key={idx} className={styles.timelineItem}>
                  <span className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineEvent}>{event.event_type.replace(/_/g, " ")}</span>
                    <span className={styles.timelineTime}>{formatUTC(event.occurred_at)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Anchor Proof */}
        {data.status === "SECURED" && data.chain_tx_id && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Anchor Proof</h2>
            <p className={styles.cardDesc}>
              This record has been anchored to a distributed ledger for tamper-evident timestamping.
            </p>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt className={styles.detailLabel}>Network Receipt</dt>
                <dd className={`${styles.detailValue} ${styles.mono}`}>{data.chain_tx_id}</dd>
              </div>
              {data.chain_timestamp && (
                <div className={styles.detailRow}>
                  <dt className={styles.detailLabel}>Observed Time (UTC)</dt>
                  <dd className={styles.detailValue}>{formatUTC(data.chain_timestamp)}</dd>
                </div>
              )}
              {data.chain_block_height && (
                <div className={styles.detailRow}>
                  <dt className={styles.detailLabel}>Block Height</dt>
                  <dd className={styles.detailValue}>{data.chain_block_height.toLocaleString()}</dd>
                </div>
              )}
              {data.chain_network && (
                <div className={styles.detailRow}>
                  <dt className={styles.detailLabel}>Network</dt>
                  <dd className={styles.detailValue}>{data.chain_network}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Footer */}
        <footer className={styles.footer}>
          <p>
            Verified by <strong>Arkova</strong> — Secure document anchoring and verification.
          </p>
          <p className={styles.footerNote}>
            No document content is stored or transmitted. Only cryptographic fingerprints are used.
          </p>
        </footer>
      </div>
    </main>
  );
}
