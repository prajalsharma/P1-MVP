"use client";

/**
 * BulkWizard — P6-S3 client component
 *
 * 4-step wizard:
 *   1. Upload CSV  2. Validate & confirm  3. Execute batch  4. Results
 *
 * Accepts profile from server parent — no additional fetches.
 * ORG_ADMIN enforcement is also done server-side in runBulkVerification.
 */

import { useState, useCallback, useRef } from "react";
import { CsvUploader, type CsvRow } from "@/components/bulk/CsvUploader";
import { runBulkVerification, type BulkRowResult } from "@/lib/bulk/runBulkVerification";
import styles from "@/app/org/bulk/bulk.module.css";

type Step = "upload" | "confirm" | "running" | "done";

function randomBatchId(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "confirm", label: "Confirm" },
    { id: "running", label: "Execute" },
    { id: "done", label: "Results" },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <ol className={styles.stepIndicator} aria-label="Wizard progress">
      {steps.map((s, idx) => {
        const state = idx < currentIdx ? "done" : idx === currentIdx ? "active" : "pending";
        return (
          <li key={s.id} className={styles.stepItem} data-state={state}>
            <span className={styles.stepBullet} aria-hidden="true">
              {state === "done" ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                idx + 1
              )}
            </span>
            <span className={styles.stepLabel}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function BulkWizard() {
  // Stable batch ID for this wizard instance
  const batchIdRef = useRef<string>(randomBatchId());
  const batchId = batchIdRef.current;

  const [step, setStep] = useState<Step>("upload");
  const [allRows, setAllRows] = useState<CsvRow[]>([]);

  const [batchResults, setBatchResults] = useState<BulkRowResult[]>([]);
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const validRows = allRows.filter((r) => r.errors.length === 0);

  const handleParsed = useCallback((rows: CsvRow[]) => {
    setAllRows(rows);
  }, []);

  const handleConfirm = () => {
    if (validRows.length === 0) return;
    setStep("confirm");
  };

  const handleRunBatch = async () => {
    setIsRunning(true);
    setGlobalError(null);
    setBatchResults([]);
    setProgressDone(0);
    setProgressTotal(validRows.length);
    setStep("running");

    const payload = validRows.map((r) => ({
      email: r.email,
      external_id: r.external_id,
      metadata: r.metadata,
    }));

    try {
      const result = await runBulkVerification(batchId, payload);

      if (!result.success) {
        setGlobalError(result.error ?? "Batch execution failed.");
        setStep("confirm");
        setIsRunning(false);
        return;
      }

      // Animate progress counter after result arrives
      const total = result.rows.length;
      setProgressTotal(total);

      for (let i = 0; i <= total; i++) {
        await new Promise<void>((res) =>
          setTimeout(res, Math.min(600 / Math.max(total, 1), 20))
        );
        setProgressDone(i);
        setBatchResults(result.rows.slice(0, i));
      }

      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setGlobalError(msg);
      setStep("confirm");
    } finally {
      setIsRunning(false);
    }
  };

  const handleRetry = () => {
    setStep("confirm");
    setGlobalError(null);
    setBatchResults([]);
    setProgressDone(0);
  };

  const handleReset = () => {
    batchIdRef.current = randomBatchId();
    setStep("upload");
    setAllRows([]);
    setBatchResults([]);
    setProgressDone(0);
    setProgressTotal(0);
    setGlobalError(null);
  };

  const finalProcessed = batchResults.filter((r) => r.status === "processed").length;
  const finalSkipped = batchResults.filter((r) => r.status === "skipped").length;
  const finalErrors = batchResults.filter((r) => r.status === "error").length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Bulk verification</h2>
          <p className={styles.pageDesc}>
            Upload a CSV to run batch anchor creation for your organisation. Execution is
            idempotent — re-running the same file is safe.
          </p>
        </div>
      </div>

      <div className={styles.wizardCard}>
        <StepIndicator step={step} />

        <div className={styles.stepBody}>
          {/* Step 1 */}
          {step === "upload" && (
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Step 1 — Upload CSV</h3>
              <p className={styles.stepHint}>
                Your file is parsed entirely in the browser. No raw file is sent to the server.
              </p>
              <CsvUploader onParsed={handleParsed} />
              {allRows.length > 0 && (
                <div className={styles.actions}>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleConfirm}
                    disabled={validRows.length === 0}
                  >
                    Continue with {validRows.length} valid row
                    {validRows.length !== 1 ? "s" : ""}
                  </button>
                  {validRows.length === 0 && allRows.length > 0 && (
                    <p className={styles.actionNote}>Fix validation errors before continuing.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step === "confirm" && (
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Step 2 — Validate &amp; confirm</h3>

              <div className={styles.confirmSummary}>
                <div className={styles.confirmStat}>
                  <span className={styles.confirmStatValue}>{validRows.length}</span>
                  <span className={styles.confirmStatLabel}>rows to process</span>
                </div>
                <div className={styles.confirmStat}>
                  <span
                    className={styles.confirmStatValue}
                    data-color="warn"
                  >
                    {allRows.length - validRows.length}
                  </span>
                  <span className={styles.confirmStatLabel}>rows skipped (invalid)</span>
                </div>
                <div className={styles.confirmStat}>
                  <span className={styles.confirmStatValue} data-color="muted">
                    {batchId.slice(0, 12)}…
                  </span>
                  <span className={styles.confirmStatLabel}>batch ID</span>
                </div>
              </div>

              {globalError && (
                <p className={styles.errorBanner} role="alert">
                  {globalError}
                </p>
              )}

              <div className={styles.confirmPreview}>
                <p className={styles.confirmPreviewLabel}>First 5 valid rows:</p>
                <ul className={styles.confirmList}>
                  {validRows.slice(0, 5).map((r) => (
                    <li key={r.lineNumber} className={styles.confirmListItem}>
                      <span className={styles.confirmEmail}>{r.email}</span>
                      {r.external_id && (
                        <span className={styles.confirmMeta}>ext: {r.external_id}</span>
                      )}
                    </li>
                  ))}
                  {validRows.length > 5 && (
                    <li className={styles.confirmListMore}>
                      +{validRows.length - 5} more…
                    </li>
                  )}
                </ul>
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => setStep("upload")}
                >
                  Back
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={handleRunBatch}
                  disabled={isRunning}
                >
                  Run batch
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === "running" && (
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Step 3 — Executing batch</h3>

              <div className={styles.progressSection}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel}>
                    {progressDone} / {progressTotal} processed
                  </span>
                  <span className={styles.progressPct}>
                    {progressTotal > 0
                      ? Math.round((progressDone / progressTotal) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuenow={progressDone}
                  aria-valuemax={progressTotal}
                >
                  <div
                    className={styles.progressFill}
                    style={{
                      width:
                        progressTotal > 0
                          ? `${Math.round((progressDone / progressTotal) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>

              {batchResults.length > 0 && (
                <div className={styles.liveResults}>
                  {batchResults.map((r, i) => (
                    <div key={i} className={styles.liveRow} data-status={r.status}>
                      <span className={styles.liveRowIcon} aria-hidden="true">
                        {r.status === "processed" && "✓"}
                        {r.status === "skipped" && "↷"}
                        {r.status === "error" && "✗"}
                      </span>
                      <span className={styles.liveRowEmail}>{r.email}</span>
                      {r.error && (
                        <span className={styles.liveRowError}>{r.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4 */}
          {step === "done" && (
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>Step 4 — Results</h3>

              <div className={styles.resultStats}>
                <div className={styles.resultStat} data-variant="success">
                  <span className={styles.resultStatValue}>{finalProcessed}</span>
                  <span className={styles.resultStatLabel}>Processed</span>
                </div>
                <div className={styles.resultStat} data-variant="neutral">
                  <span className={styles.resultStatValue}>{finalSkipped}</span>
                  <span className={styles.resultStatLabel}>Skipped (idempotent)</span>
                </div>
                <div className={styles.resultStat} data-variant="error">
                  <span className={styles.resultStatValue}>{finalErrors}</span>
                  <span className={styles.resultStatLabel}>Errors</span>
                </div>
              </div>

              {finalErrors > 0 && (
                <div className={styles.errorTable}>
                  <p className={styles.errorTableTitle}>Failed rows</p>
                  {batchResults
                    .filter((r) => r.status === "error")
                    .map((r, i) => (
                      <div key={i} className={styles.errorTableRow}>
                        <span className={styles.errorTableEmail}>{r.email}</span>
                        <span className={styles.errorTableMsg}>{r.error}</span>
                      </div>
                    ))}
                </div>
              )}

              <div className={styles.resultNote}>
                <p>
                  An audit event <code>BULK_VERIFICATION_RUN</code> has been recorded.
                  Re-running this batch will skip already-processed rows.
                </p>
              </div>

              <div className={styles.actions}>
                {finalErrors > 0 && (
                  <button className={styles.btnSecondary} onClick={handleRetry}>
                    Retry failed rows
                  </button>
                )}
                <button className={styles.btnPrimary} onClick={handleReset}>
                  New batch
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
