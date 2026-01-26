/**
 * Date formatting utilities using Intl.DateTimeFormat
 * Replaces date-fns dependency
 */

export interface DateFormatOptions {
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
  hour12?: boolean;
  timeZone?: string;
}

/**
 * Format a timestamp (milliseconds) to a date string
 */
export function formatDate(timestamp: number, options?: DateFormatOptions): string {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: options?.dateStyle,
    timeStyle: options?.timeStyle,
    year: options?.year,
    month: options?.month,
    day: options?.day,
    hour: options?.hour,
    minute: options?.minute,
    second: options?.second,
    hour12: options?.hour12 ?? false,
    timeZone: options?.timeZone,
  });
  return formatter.format(date);
}

/**
 * Format a timestamp to a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} ago`;
  if (hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  if (minutes > 0) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  return "Just now";
}

/**
 * Format a timestamp for chart axis (compact format)
 */
export function formatChartTime(timestamp: number, timeRange: number): string {
  const date = new Date(timestamp);
  const diff = timeRange;

  // If range is less than 1 hour, show minutes
  if (diff < 3600_000) {
    return formatDate(timestamp, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // If range is less than 24 hours, show hours
  if (diff < 86400_000) {
    return formatDate(timestamp, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // If range is less than 7 days, show day and hour
  if (diff < 604800_000) {
    return formatDate(timestamp, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
    });
  }

  // Otherwise show date
  return formatDate(timestamp, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a timestamp to ISO string for API requests
 */
export function formatISO(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Parse ISO string to timestamp
 */
export function parseISO(isoString: string): number {
  return new Date(isoString).getTime();
}
