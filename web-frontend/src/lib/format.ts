/**
 * Shared formatting helpers used across the app so numbers, currency,
 * dates, and enum labels always render consistently.
 */

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(
    value,
  );
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsInUnit] of divisions) {
    if (Math.abs(diffSec) >= secondsInUnit) {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(diffSec, "second");
}

/** Turn snake_case / SCREAMING_SNAKE enum values into "Title Case" labels. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "--";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function initials(first?: string | null, last?: string | null): string {
  const a = first?.trim()?.[0] ?? "";
  const b = last?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "U";
}

/** Tailwind class helpers for status/side badges, kept in one place. */
export function sideTone(side: string | null | undefined) {
  return side === "buy"
    ? "text-gain bg-gain/10 border-gain/20"
    : "text-loss bg-loss/10 border-loss/20";
}

export function statusTone(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (
    [
      "active",
      "approved",
      "filled",
      "settled",
      "completed",
      "verified",
      "confirmed",
    ].includes(s)
  )
    return "text-gain bg-gain/10 border-gain/20";
  if (
    [
      "pending",
      "pending_review",
      "in_progress",
      "open",
      "under_review",
      "partially_filled",
    ].includes(s)
  )
    return "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400";
  if (
    [
      "rejected",
      "cancelled",
      "suspended",
      "expired",
      "failed",
      "closed",
      "locked",
    ].includes(s)
  )
    return "text-loss bg-loss/10 border-loss/20";
  return "text-muted-foreground bg-muted border-border";
}
