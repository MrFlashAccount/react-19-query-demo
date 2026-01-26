/**
 * Number formatting utilities using Intl.NumberFormat
 */

export interface NumberFormatOptions {
  style?: "decimal" | "currency" | "percent" | "unit";
  currency?: string;
  unit?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: "standard" | "scientific" | "engineering" | "compact";
  compactDisplay?: "short" | "long";
}

/**
 * Format a number with locale-aware formatting
 */
export function formatNumber(value: number, options?: NumberFormatOptions): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: options?.style ?? "decimal",
    currency: options?.currency,
    unit: options?.unit,
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    notation: options?.notation,
    compactDisplay: options?.compactDisplay,
  });
  return formatter.format(value);
}

/**
 * Format a number as bytes (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "byte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  });

  if (bytes === 0) return "0 B";
  if (bytes < 1024) return formatter.format(bytes);
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024))} MB`;
  return `${formatNumber(bytes / (1024 * 1024 * 1024))} GB`;
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return formatNumber(value, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
