// Web Components
export { FlameGraphToggle } from "./FlameGraphToggle";
export { FlameGraphTimeline } from "./FlameGraphTimeline";
export { FlameGraphCanvas } from "./FlameGraphCanvas";
export { FlameGraphDetails } from "./FlameGraphDetails";
export { FlameGraphDialog } from "./FlameGraphDialog";
export { FlameGraphResizeHandle } from "./FlameGraphResizeHandle";
export type { ResizeEventDetail } from "./FlameGraphResizeHandle";

// Reporter
export { FlameGraphReporter } from "./FlameGraphReporter";

// Types
export type {
  FlameGraphSpan,
  FlameGraphReporterOptions,
  TimeRange,
  ViewState,
  FlameGraphEvent,
} from "./types";
export type { SpanBufferViews } from "./SpanBuffer";

// Utils
export { COLOR_PALETTE, formatTime, escapeHtml, lightenColor } from "./styles";
