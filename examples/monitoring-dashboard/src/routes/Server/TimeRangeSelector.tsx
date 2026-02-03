/**
 * Time Range Selector Component
 *
 * Provides preset time ranges, manual refresh, auto-refresh, and custom range picker
 */

import { useState, useTransition, useRef } from "react";
import {
  Button,
  Menu,
  MenuTrigger,
  Text,
  Dialog,
  DialogTrigger,
} from "@/components/AriaComponents";
import { useServerContext } from "./ServerContext";
import { type TimeRangePreset, formatPresetLabel } from "@/utilities/timeRange";
import { RefreshCw, Calendar, ChevronDown, Clock } from "lucide-react";

const PRESETS: TimeRangePreset[] = [
  "last_5m",
  "last_15m",
  "last_30m",
  "last_1h",
  "last_6h",
  "last_12h",
  "last_24h",
  "last_72h",
];

const AUTO_REFRESH_OPTIONS = [
  { label: "Off", value: null },
  { label: "Every 5s", value: 5000 },
  { label: "Every 10s", value: 10000 },
  { label: "Every 30s", value: 30000 },
  { label: "Every 1m", value: 60000 },
];

export function TimeRangeSelector() {
  const { range, onRangeChange, refreshData, autoRefreshInterval, setAutoRefreshInterval } =
    useServerContext();

  const [isRefreshing, startRefreshTransition] = useTransition();

  // Check if current range is a preset
  const isPreset = PRESETS.includes(range as TimeRangePreset);
  const isCustomRange = !isPreset;

  const handlePresetSelect = (preset: TimeRangePreset) => {
    onRangeChange?.(preset);
  };

  const handleRefresh = () => {
    startRefreshTransition(() => {
      refreshData();
    });
  };

  const handleAutoRefreshChange = (value: number | null) => {
    setAutoRefreshInterval(value);
  };

  const currentLabel = isPreset
    ? formatPresetLabel(range as TimeRangePreset)
    : range.startsWith("custom:")
      ? (() => {
          const parts = range.slice(7).split(":");
          const fromH = parseFloat(parts[0]);
          const toH = parseFloat(parts[1]);
          const duration = toH - fromH;
          return `Custom: ${Math.round(fromH)}h to ${toH === 0 ? "now" : Math.round(toH) + "h"} (${duration}h)`;
        })()
      : "Custom range";

  const autoRefreshLabel =
    AUTO_REFRESH_OPTIONS.find((opt) => opt.value === autoRefreshInterval)?.label ?? "Off";

  return (
    <div className="flex items-center gap-2">
      {/* Time Range Selector */}
      <MenuTrigger>
        <Button variant="outline" size="medium" className="flex items-center gap-2">
          <Calendar className="size-4" />
          <span>{currentLabel}</span>
          <ChevronDown className="size-3" />
        </Button>

        <Menu>
          <Menu.Section title="QUICK SELECT">
            {PRESETS.map((preset) => (
              <Menu.Item
                key={preset}
                onAction={() => handlePresetSelect(preset)}
                className={range === preset ? "bg-primary/10" : ""}
              >
                {formatPresetLabel(preset)}
              </Menu.Item>
            ))}
          </Menu.Section>

          <Menu.Separator />

          <Menu.Section title="CUSTOM RANGE">
            <DialogTrigger>
              <Menu.Item>
                <div className="flex items-center gap-2">
                  <Clock className="size-4" />
                  Custom range
                </div>
              </Menu.Item>

              <Dialog type="modal" title="Custom Time Range" size="medium">
                <CustomRangeDialog
                  currentRange={range}
                  onApply={(customRange) => onRangeChange?.(customRange)}
                />
              </Dialog>
            </DialogTrigger>
          </Menu.Section>
        </Menu>
      </MenuTrigger>

      {/* Manual Refresh Button */}
      <Button
        variant="outline"
        size="medium"
        onPress={handleRefresh}
        isLoading={isRefreshing}
        className="flex items-center gap-2"
      >
        <RefreshCw className="size-4" />
      </Button>

      {/* Auto Refresh Dropdown */}
      <MenuTrigger>
        <Button variant="outline" size="medium" className="flex items-center gap-2">
          <span>{autoRefreshLabel}</span>
          <ChevronDown className="size-3" />
        </Button>

        <Menu>
          {AUTO_REFRESH_OPTIONS.map((option) => (
            <Menu.Item
              key={option.label}
              onAction={() => handleAutoRefreshChange(option.value)}
              className={autoRefreshInterval === option.value ? "bg-primary/10" : ""}
            >
              {option.label}
            </Menu.Item>
          ))}
        </Menu>
      </MenuTrigger>
    </div>
  );
}

interface CustomRangeDialogProps {
  currentRange: string;
  onApply: (range: string) => void;
}

function CustomRangeDialog({ currentRange, onApply }: CustomRangeDialogProps) {
  // Parse initial range
  let initialFromHours = -6;
  let initialToHours = 0;

  if (currentRange.startsWith("custom:")) {
    const parts = currentRange.slice(7).split(":");
    initialFromHours = parseFloat(parts[0]) || -6;
    initialToHours = parseFloat(parts[1]) || 0;
  }

  // State: hours offset from now (negative values)
  const [fromHours, setFromHours] = useState(
    Math.max(-72, Math.min(0, Math.round(initialFromHours))),
  );
  const [toHours, setToHours] = useState(Math.max(-72, Math.min(0, Math.round(initialToHours))));

  // Refs for the slider inputs
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Ensure min range of 1h and max range of 24h
  const adjustRange = (newFrom: number, newTo: number): [number, number] => {
    const duration = newTo - newFrom;

    // Min range: 1h
    if (duration < 1) {
      if (newFrom !== fromHours) {
        // From thumb moved, adjust to
        newTo = Math.min(0, newFrom + 1);
      } else {
        // To thumb moved, adjust from
        newFrom = Math.max(-72, newTo - 1);
      }
    }

    // Max range: 24h
    if (duration > 24) {
      if (newFrom !== fromHours) {
        // From thumb moved, adjust to
        newTo = Math.min(0, newFrom + 24);
      } else {
        // To thumb moved, adjust from
        newFrom = Math.max(-72, newTo - 24);
      }
    }

    return [newFrom, newTo];
  };

  const handleFromChange = (value: number) => {
    const [adjustedFrom, adjustedTo] = adjustRange(value, toHours);
    setFromHours(adjustedFrom);
    setToHours(adjustedTo);
  };

  const handleToChange = (value: number) => {
    const [adjustedFrom, adjustedTo] = adjustRange(fromHours, value);
    setFromHours(adjustedFrom);
    setToHours(adjustedTo);
  };

  const handleApply = () => {
    const rangeString = `custom:${fromHours}:${toHours}`;
    onApply(rangeString);
  };

  const duration = toHours - fromHours;
  const now = Date.now();
  const fromDate = new Date(now + fromHours * 60 * 60 * 1000);
  const toDate = new Date(now + toHours * 60 * 60 * 1000);

  // Calculate thumb positions for visual display
  const fromPercent = ((fromHours + 72) / 72) * 100;
  const toPercent = ((toHours + 72) / 72) * 100;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Display Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <Text variant="overline" color="muted">
            FROM
          </Text>
          <Text variant="body" weight="semibold">
            {fromHours}h
          </Text>
          <Text variant="body-sm" color="muted">
            {fromDate.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </div>

        <div className="flex flex-col gap-1">
          <Text variant="overline" color="muted">
            TO
          </Text>
          <Text variant="body" weight="semibold">
            {toHours === 0 ? "Now" : `${toHours}h`}
          </Text>
          <Text variant="body-sm" color="muted">
            {toDate.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </div>

        <div className="flex flex-col gap-1">
          <Text variant="overline" color="muted">
            DURATION
          </Text>
          <Text variant="body" weight="semibold">
            {duration} hours
          </Text>
        </div>
      </div>

      {/* Dual Thumb Slider */}
      <div className="flex flex-col gap-4">
        <div className="relative h-12 w-full">
          {/* Track background */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-border rounded-full" />

          {/* Active range */}
          <div
            className="absolute top-5 h-1 bg-primary rounded-full"
            style={{
              left: `${fromPercent}%`,
              right: `${100 - toPercent}%`,
            }}
          />

          {/* From thumb */}
          <input
            ref={fromRef}
            type="range"
            min="-72"
            max="0"
            step="1"
            value={fromHours}
            onChange={(e) => handleFromChange(Number(e.target.value))}
            className="absolute top-0 left-0 w-full h-12 appearance-none bg-transparent pointer-events-auto cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 
              [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:cursor-grab 
              [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 
              [&::-webkit-slider-thumb]:transition-transform
              [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 
              [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:cursor-grab 
              [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:hover:scale-110 
              [&::-moz-range-thumb]:transition-transform"
            style={{ zIndex: fromHours > toHours - 2 ? 2 : 1 }}
          />

          {/* To thumb */}
          <input
            ref={toRef}
            type="range"
            min="-72"
            max="0"
            step="1"
            value={toHours}
            onChange={(e) => handleToChange(Number(e.target.value))}
            className="absolute top-0 left-0 w-full h-12 appearance-none bg-transparent pointer-events-auto cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 
              [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:cursor-grab 
              [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 
              [&::-webkit-slider-thumb]:transition-transform
              [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 
              [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:cursor-grab 
              [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:hover:scale-110 
              [&::-moz-range-thumb]:transition-transform"
            style={{ zIndex: toHours < fromHours + 2 ? 2 : 1 }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Now</span>
          <span>-12h</span>
          <span>-24h</span>
          <span>-36h</span>
          <span>-48h</span>
          <span>-60h</span>
          <span>-72h</span>
        </div>
      </div>

      {/* Apply Button */}
      <div className="flex justify-end gap-2">
        <Button variant="solid" size="medium" onPress={handleApply}>
          Apply Range
        </Button>
      </div>
    </div>
  );
}
