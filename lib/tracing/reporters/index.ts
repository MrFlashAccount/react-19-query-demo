export { BaseReporter } from "./BaseReporter";
export { LoggerReporter } from "./LoggerReporter";
export type { LoggerReporterOptions } from "./LoggerReporter";
export { DevtoolsReporter } from "./DevtoolsReporter";
export type { DevtoolsReporterOptions } from "./DevtoolsReporter";

// Flame Graph (Web Components)
export { FlameGraphReporter } from "./flame-graph";
export type {
  FlameGraphSpan,
  FlameGraphReporterOptions,
  TimeRange as FlameGraphTimeRange,
  ViewState as FlameGraphViewState,
} from "./flame-graph";

// Also export individual components for advanced usage
export {
  FlameGraphToggle,
  FlameGraphTimeline,
  FlameGraphCanvas,
  FlameGraphDetails,
  FlameGraphDialog,
} from "./flame-graph";

export type {
  IReporter,
  IReporterEventHandlers,
  BaseReporterOptions,
  SpanMetrics,
} from "./types";
