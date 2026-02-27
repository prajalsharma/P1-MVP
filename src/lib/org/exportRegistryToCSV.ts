import type { Anchor } from "@/types/database.types";

const CSV_COLUMNS = [
  "anchor_id",
  "file_name",
  "fingerprint",
  "status",
  "created_at_utc",
] as const;

function escapeCell(value: string): string {
  // RFC 4180 — wrap in quotes if value contains comma, quote, or newline
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert a list of org-scoped anchors into a RFC-4180 CSV string.
 * Only safe, non-sensitive fields are included.
 */
export function buildRegistryCSV(anchors: Anchor[]): string {
  const header = CSV_COLUMNS.join(",");

  const rows = anchors.map((a) =>
    [
      escapeCell(a.id),
      escapeCell(a.file_name),
      escapeCell(a.file_fingerprint),
      escapeCell(a.status),
      escapeCell(new Date(a.created_at).toISOString()), // always UTC
    ].join(",")
  );

  return [header, ...rows].join("\r\n");
}

/**
 * Trigger a CSV file download in the browser.
 * Call this only from client components.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
