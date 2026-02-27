"use client";

import { useCallback, useRef, useState } from "react";
import { hashFile, formatBytes, type FileFingerprint } from "@/lib/fileHasher";
import styles from "./FileDropzone.module.css";

interface FileDropzoneProps {
  onFingerprinted: (result: FileFingerprint) => void;
}

export function FileDropzone({ onFingerprinted }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hashing, setHashing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setHashing(true);
      try {
        const result = await hashFile(file);
        onFingerprinted(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to hash file.");
      } finally {
        setHashing(false);
      }
    },
    [onFingerprinted]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      processFile(files[0]);
    },
    [processFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  return (
    <div
      className={styles.zone}
      data-drag={dragOver}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !hashing && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Drop a file here or click to browse"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        aria-hidden="true"
        tabIndex={-1}
        className={styles.hiddenInput}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className={styles.iconWrap}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 16V8M12 8l-3 3M12 8l3 3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 15v2a4 4 0 004 4h10a4 4 0 004-4v-2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {hashing ? (
        <p className={styles.label}>Computing fingerprint…</p>
      ) : (
        <>
          <p className={styles.label}>Drop a file here, or click to browse</p>
          <p className={styles.sub}>Any file type · max 2 GB</p>
        </>
      )}

      <div className={styles.securityBadge} aria-live="polite">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1.5L2 3v3c0 2.485 1.72 4.81 4 5.5 2.28-.69 4-3.015 4-5.5V3L6 1.5z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
        File never leaves your device
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
