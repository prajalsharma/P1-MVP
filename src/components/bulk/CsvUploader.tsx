"use client";

/**
 * CsvUploader — P6-S1
 *
 * Parses a CSV file entirely in-browser.
 * Emits structured rows: { email, external_id?, metadata? }
 * No file content is ever sent to a server.
 *
 * Columns recognised (case-insensitive):
 *   email        — required
 *   external_id  — optional
 *   metadata     — optional (stored as-is string)
 */

import { useRef, useState, useCallback } from "react";
import styles from "./CsvUploader.module.css";

export interface CsvRow {
  /** 1-based line number in the original file */
  lineNumber: number;
  email: string;
  external_id?: string;
  metadata?: string;
  /** Validation errors for this row */
  errors: string[];
}

interface CsvUploaderProps {
  onParsed: (rows: CsvRow[]) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCSV(text: string): { headers: string[]; rawRows: string[][] } {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rawRows: [] };

  function splitLine(line: string): string[] {
    const cols: string[] = [];
    let cur = "";
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const rawRows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip empty lines
    rawRows.push(splitLine(line));
  }

  return { headers, rawRows };
}

function buildRows(headers: string[], rawRows: string[][]): CsvRow[] {
  const emailIdx = headers.indexOf("email");
  const extIdx = headers.indexOf("external_id");
  const metaIdx = headers.indexOf("metadata");

  return rawRows.map((cols, i) => {
    const lineNumber = i + 2; // +2: 1-based + skip header row
    const email = (cols[emailIdx] ?? "").trim();
    const external_id = extIdx >= 0 ? (cols[extIdx] ?? "").trim() || undefined : undefined;
    const metadata = metaIdx >= 0 ? (cols[metaIdx] ?? "").trim() || undefined : undefined;

    const errors: string[] = [];

    if (!email) {
      errors.push("email is required");
    } else if (!EMAIL_RE.test(email)) {
      errors.push(`invalid email: "${email}"`);
    }

    return { lineNumber, email, external_id, metadata, errors };
  });
}

export function CsvUploader({ onParsed }: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [missingEmailCol, setMissingEmailCol] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const process = useCallback(
    (file: File) => {
      setParseError(null);
      setMissingEmailCol(false);

      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setParseError("Only .csv files are supported.");
        return;
      }

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rawRows } = parseCSV(text);

        if (!headers.includes("email")) {
          setMissingEmailCol(true);
          setRows([]);
          onParsed([]);
          return;
        }

        const parsed = buildRows(headers, rawRows);
        setRows(parsed);
        // Emit all rows (including invalid) — wizard decides what to do
        onParsed(parsed);
      };
      reader.onerror = () => setParseError("Failed to read file.");
      reader.readAsText(file);
    },
    [onParsed]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) process(file);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  return (
    <div className={styles.root}>
      {/* Drop zone */}
      <div
        className={styles.dropzone}
        data-dragging={isDragging ? "true" : undefined}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className={styles.hiddenInput}
          onChange={handleFileChange}
          aria-label="CSV file input"
        />
        <div className={styles.dropzoneIcon} aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4v18M9 11l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 26h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p className={styles.dropzoneText}>
          {fileName ? (
            <span className={styles.fileName}>{fileName}</span>
          ) : (
            <>
              Drop a <strong>.csv</strong> file here, or click to browse
            </>
          )}
        </p>
        <p className={styles.dropzoneHint}>Required column: <code>email</code> — optional: <code>external_id</code>, <code>metadata</code></p>
      </div>

      {/* Errors */}
      {parseError && (
        <p className={styles.errorBanner} role="alert">{parseError}</p>
      )}

      {missingEmailCol && (
        <p className={styles.errorBanner} role="alert">
          CSV must include an <code>email</code> column (header row, case-insensitive).
        </p>
      )}

      {/* Summary */}
      {rows.length > 0 && (
        <div className={styles.summary}>
          <span className={styles.summaryChip} data-variant="success">
            {validRows.length} valid
          </span>
          {invalidRows.length > 0 && (
            <span className={styles.summaryChip} data-variant="error">
              {invalidRows.length} invalid
            </span>
          )}
          <span className={styles.summaryTotal}>{rows.length} rows total</span>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className={styles.tableWrapper} aria-label="CSV preview">
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Line</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>External ID</th>
                <th className={styles.th}>Metadata</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.lineNumber} className={styles.tr} data-invalid={row.errors.length > 0 ? "true" : undefined}>
                  <td className={styles.td}>{row.lineNumber}</td>
                  <td className={styles.td}>{row.email || <em className={styles.empty}>—</em>}</td>
                  <td className={styles.td}>{row.external_id || <em className={styles.empty}>—</em>}</td>
                  <td className={styles.td}>{row.metadata || <em className={styles.empty}>—</em>}</td>
                  <td className={styles.td}>
                    {row.errors.length === 0 ? (
                      <span className={styles.statusOk}>Valid</span>
                    ) : (
                      <span className={styles.statusErr} title={row.errors.join("; ")}>
                        {row.errors[0]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
