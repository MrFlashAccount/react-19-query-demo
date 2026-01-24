interface QuerySelectable {
  querySelector(selector: string): HTMLElement | null;
}

export function getElement<T extends HTMLElement>(selector: string, parent: QuerySelectable): T {
  const element = parent.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element as T;
}

export const css = String.raw;
export const html = String.raw;

// Shared rendering constants
export const MIN_TICK_SPACING = 110;
export const PADDING_LEFT = 12;

// Tick generation utilities
export function niceNumber(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  let niceFraction: number;
  if (fraction <= 1.5) niceFraction = 1;
  else if (fraction <= 3.5) niceFraction = 2;
  else if (fraction <= 7.5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

export function generateNiceTicks(
  rangeStart: number,
  rangeEnd: number,
  targetTickCount: number,
): number[] {
  const range = rangeEnd - rangeStart;
  if (range <= 0 || targetTickCount <= 0) return [];

  const rawStep = range / targetTickCount;
  const niceStep = niceNumber(rawStep);
  const niceStart = Math.floor(rangeStart / niceStep) * niceStep;

  const ticks: number[] = [];
  const epsilon = niceStep * 0.001;

  for (let tick = niceStart; tick <= rangeEnd + epsilon; tick += niceStep) {
    if (tick >= rangeStart - epsilon) {
      const roundedTick = Math.round(tick / epsilon) * epsilon;
      ticks.push(roundedTick);
    }
  }

  return ticks;
}

export type Units =
  | "century"
  | "decade"
  | "year"
  | "day"
  | "hour"
  | "min"
  | "sec"
  | "ms"
  | "microsec";

// we use μs instead of ms as the smallest unit because using ms might lead to rounding errors
const MICRO_SEC = 1;
const MS = 1_000 * MICRO_SEC;
const SEC = 1_000 * MS;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;
const DECADE = 10 * YEAR;
const CENTURY = 100 * YEAR;

export type Unit = {
  unit: string;
  shortUnit: string;
  factor: number;
};

export type Duration = Record<Units, number>;

export const factors: Record<Units, number> = {
  century: CENTURY,
  decade: DECADE,
  year: YEAR,
  day: DAY,
  hour: HOUR,
  min: MIN,
  sec: SEC,
  ms: MS,
  microsec: MICRO_SEC,
};

export const unitsRecord: Readonly<Record<Units, Unit>> = {
  century: {
    factor: factors.century,
    unit: "century",
    shortUnit: "cent",
  },
  decade: {
    factor: factors.decade,
    unit: "decade",
    shortUnit: "dec",
  },
  year: {
    factor: factors.year,
    unit: "year",
    shortUnit: "y",
  },
  day: {
    factor: factors.day,
    unit: "day",
    shortUnit: "d",
  },
  hour: {
    factor: factors.hour,
    unit: "hour",
    shortUnit: "h",
  },
  min: {
    factor: factors.min,
    unit: "min",
    shortUnit: "m",
  },
  sec: {
    factor: factors.sec,
    unit: "sec",
    shortUnit: "s",
  },
  ms: {
    factor: factors.ms,
    unit: "ms",
    shortUnit: "ms",
  },
  microsec: {
    factor: factors.microsec,
    unit: "\u03BCs",
    shortUnit: "\u03BCs",
  },
};

const unitsEntries = Object.entries(unitsRecord).sort((a, b) => b[1].factor - a[1].factor) as [
  Units,
  Unit,
][];

export function durationToValue(duration: Duration): number {
  return Object.entries(duration).reduce(
    (acc, [key, value]) => acc + value * factors[key as Units],
    0,
  );
}

export type ValueToDurationOptions = {
  maxUnit?: Units;
  minUnit?: Units;
};

export function valueToDuration(
  valueInMicroSeconds: number,
  options: ValueToDurationOptions = {},
): Duration {
  const { maxUnit = "century", minUnit = "microsec" } = options;

  const maxUnitFactor = factors[maxUnit];
  const minUnitFactor = factors[minUnit];

  const duration: Duration = {
    century: 0,
    decade: 0,
    year: 0,
    day: 0,
    hour: 0,
    min: 0,
    sec: 0,
    ms: 0,
    microsec: 0,
  };

  let prevUnit = unitsEntries[0][0];

  for (const [key, unit] of unitsEntries) {
    if (unit.factor > maxUnitFactor) {
      continue;
    }

    if (unit.factor < minUnitFactor) {
      duration[prevUnit] += valueInMicroSeconds / unitsRecord[prevUnit].factor;
      break;
    }

    if (valueInMicroSeconds >= unit.factor) {
      duration[key] = Math.floor(valueInMicroSeconds / unit.factor);
      valueInMicroSeconds -= duration[key] * unit.factor;
    }

    prevUnit = key;
  }

  return duration;
}

export function format(value: number): string {
  if (value === 0) {
    return "  0";
  }

  const valueInMicroSeconds = value * 1_000;

  const duration = valueToDuration(valueInMicroSeconds);

  return formatDuration(duration);
}

function formatDuration(duration: Duration): string {
  const { century, decade, year, day, hour, min, sec, ms, microsec } = duration;

  const formattedSentury = century > 0 ? formatUnit(century, unitsRecord.century) : null;
  const formattedDecade = decade > 0 ? formatUnit(decade, unitsRecord.decade) : null;
  const formattedYears = year > 0 ? formatUnit(year, unitsRecord.year) : null;
  const formattedDays = day > 0 ? formatUnit(day, unitsRecord.day) : null;
  const formattedHours = hour > 0 ? formatUnit(hour, unitsRecord.hour) : null;
  const formattedMinutes = min > 0 ? formatUnit(min, unitsRecord.min) : null;
  const formattedSeconds = sec > 0 ? formatUnit(sec, unitsRecord.sec) : null;
  const formattedMilliseconds = ms > 0 ? formatUnit(ms, unitsRecord.ms) : null;
  const formattedMicroseconds = microsec > 0 ? formatUnit(microsec, unitsRecord.microsec) : null;

  return (
    [
      formattedSentury,
      formattedDecade,
      formattedYears,
      formattedDays,
      formattedHours,
      formattedMinutes,
      formattedSeconds,
      formattedMilliseconds,
      formattedMicroseconds,
    ]
      .filter(Boolean)
      .join("\u00A0") || "0s"
  );
}

function formatUnit(value: number, unit: Unit, shortUnit = true): string {
  return `${value}${shortUnit ? unit.shortUnit : unit.unit}`;
}

export function addEventListener<T extends AbortSignal, EventName extends "abort">(
  signal: T,
  event: EventName,
  listener: (event: AbortSignalEventMap[EventName]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function addEventListener<T extends Window, K extends keyof WindowEventMap>(
  el: T,
  event: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function addEventListener<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
  el: T,
  event: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  el.addEventListener(event, listener, options);
  return () => el.removeEventListener(event, listener, options);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
