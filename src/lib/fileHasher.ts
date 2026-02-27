/**
 * fileHasher.ts — Client-side SHA-256 fingerprinting.
 * SECURITY: The file is read entirely in the browser via Web Crypto API.
 * Raw file bytes are NEVER sent over the network; only the hex-encoded digest is used.
 */

export interface FileFingerprint {
  /** SHA-256 hex digest */
  fingerprint: string;
  file_name: string;
  file_size_bytes: number;
  file_mime: string;
}

/**
 * Hash a File using the browser's native crypto.subtle.digest (SHA-256).
 * Returns a hex-encoded fingerprint and file metadata.
 * Throws if the browser does not support crypto.subtle.
 */
export async function hashFile(file: File): Promise<FileFingerprint> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto API is not available in this browser.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return {
    fingerprint,
    file_name: file.name,
    file_size_bytes: file.size,
    file_mime: file.type || "application/octet-stream",
  };
}

/** Format bytes to a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
