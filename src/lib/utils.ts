import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a timestamp to UTC with an optional local time component.
 * Format: YYYY-MM-DD HH:mm:ss UTC (Local: HH:mm:ss TZ)
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;

  // 1. Format UTC: YYYY-MM-DD HH:mm:ss UTC
  const pad = (n: number) => n.toString().padStart(2, "0");
  const utcStr = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;

  try {
    // 2. Format Local: HH:mm:ss TZ
    const localTime = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const tzName = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value || "";

    return `${utcStr} (${localTime}${tzName ? " " + tzName : ""})`;
  } catch {
    return utcStr;
  }
}
