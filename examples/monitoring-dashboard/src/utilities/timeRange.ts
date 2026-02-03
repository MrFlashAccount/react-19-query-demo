/**
 * Time range utilities for parsing and formatting relative time ranges
 */

export type TimeRangePreset =
  | "last_5m"
  | "last_15m"
  | "last_30m"
  | "last_1h"
  | "last_6h"
  | "last_12h"
  | "last_24h"
  | "last_72h";

export interface TimeRange {
  startTime: number;
  endTime: number;
}

const PRESET_DURATIONS: Record<TimeRangePreset, number> = {
  last_5m: 5 * 60 * 1000,
  last_15m: 15 * 60 * 1000,
  last_30m: 30 * 60 * 1000,
  last_1h: 60 * 60 * 1000,
  last_6h: 6 * 60 * 60 * 1000,
  last_12h: 12 * 60 * 60 * 1000,
  last_24h: 24 * 60 * 60 * 1000,
  last_72h: 72 * 60 * 60 * 1000,
};

/**
 * Parse a range parameter into startTime and endTime
 * Supports:
 * - Presets: "last_5m", "last_15m", etc.
 * - Custom: "custom:<fromHours>:<toHours>" where hours are negative offsets from now
 */
export function parseTimeRange(range: string, now: number = Date.now()): TimeRange | null {
  // Check if it's a preset
  if (range in PRESET_DURATIONS) {
    const duration = PRESET_DURATIONS[range as TimeRangePreset];
    return {
      startTime: now - duration,
      endTime: now,
    };
  }

  // Check if it's a custom range
  if (range.startsWith("custom:")) {
    const parts = range.slice(7).split(":");
    if (parts.length !== 2) return null;

    const fromHours = parseFloat(parts[0]);
    const toHours = parseFloat(parts[1]);

    if (isNaN(fromHours) || isNaN(toHours)) return null;

    // Convert hours to milliseconds (hours are negative offsets)
    const startTime = now + fromHours * 60 * 60 * 1000;
    const endTime = now + toHours * 60 * 60 * 1000;

    return { startTime, endTime };
  }

  return null;
}

/**
 * Format a duration in milliseconds to a human-readable label
 */
export function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / (60 * 1000));
  const hours = Math.floor(durationMs / (60 * 60 * 1000));
  const days = Math.floor(durationMs / (24 * 60 * 60 * 1000));

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Format a preset to a human-readable label
 */
export function formatPresetLabel(preset: TimeRangePreset): string {
  const labels: Record<TimeRangePreset, string> = {
    last_5m: "Last 5 minutes",
    last_15m: "Last 15 minutes",
    last_30m: "Last 30 minutes",
    last_1h: "Last 1 hour",
    last_6h: "Last 6 hours",
    last_12h: "Last 12 hours",
    last_24h: "Last 24 hours",
    last_72h: "Last 72 hours",
  };
  return labels[preset];
}

/**
 * Get the preset that matches the given time range, if any
 */
export function getMatchingPreset(
  startTime: number,
  endTime: number,
  now: number = Date.now(),
): TimeRangePreset | null {
  const duration = endTime - startTime;
  const endDiff = Math.abs(endTime - now);

  // Allow 10 second tolerance for "now"
  if (endDiff > 10000) return null;

  for (const [preset, presetDuration] of Object.entries(PRESET_DURATIONS)) {
    if (Math.abs(duration - presetDuration) < 1000) {
      return preset as TimeRangePreset;
    }
  }

  return null;
}

/**
 * Convert time range to hours offset for custom range slider
 */
export function timeRangeToHoursOffset(
  startTime: number,
  endTime: number,
  now: number = Date.now(),
): { fromHours: number; toHours: number } {
  return {
    fromHours: (startTime - now) / (60 * 60 * 1000),
    toHours: (endTime - now) / (60 * 60 * 1000),
  };
}

/**
 * Format custom range for display
 */
export function formatCustomRange(
  startTime: number,
  endTime: number,
  now: number = Date.now(),
): string {
  const { fromHours, toHours } = timeRangeToHoursOffset(startTime, endTime, now);
  const duration = endTime - startTime;

  return `Custom: ${Math.round(fromHours)}h to ${toHours === 0 ? "now" : Math.round(toHours) + "h"} (${formatDuration(duration)})`;
}
