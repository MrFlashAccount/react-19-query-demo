import type { SpanId, SpanState } from "../../types";
import type {
  FlameGraphSpan,
  TimeRange,
  LayoutConfig,
  LayoutResult,
  GridConfig,
  ComponentDimensions,
  Position,
  HandlePosition,
} from "./types";
import {
  LAYOUT_CONSTANTS,
  MIN_VISIBLE_DURATION_MS,
  MAX_SAFE_ZOOM,
  CANVAS_PADDING_LEFT,
  CANVAS_PADDING_RIGHT,
  CANVAS_PAN_MARGIN_PX,
} from "./types";
import { clamp } from "./utilities";
import { createStore, type StoreApi } from "./store";
import {
  CODE_TO_COLOR,
  CODE_TO_STATUS,
  COLOR_TO_CODE,
  DEFAULT_SPAN_CAPACITY,
  DEFAULT_STRING_CAPACITY,
  STATUS_TO_CODE,
  bumpSpanVersion,
  cloneSpanBuffer,
  createSpanBuffer,
  encoder,
  encodeName,
  getSpansCount,
  readDuration,
  readSpanId,
  readSpanName,
  writeSpanId,
  type SpanBufferViews,
} from "./SpanBuffer";

export interface FlameGraphViewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
  isOpen: boolean;
  isPipMode: boolean;
  height: number;
  detailsPanel: {
    position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    open: boolean;
    height: number;
    width: number;
  };
  canvas: {
    width: number;
    height: number;
  };
  layout: LayoutConfig;
  calculatedLayout: LayoutResult;
}

export interface FlameGraphState extends Record<string, unknown> {
  spanBuffer: SpanBufferViews;
  spansCount: number;
  spanVersion: number;
  selectedSpanIndex: number | null;
  viewState: FlameGraphViewState;
  isRecording: boolean;
  isOpen: boolean;
  isPipMode: boolean;
  height: number;
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  dialogPosition: "bottom",
  detailsPosition: "bottom",
  dialogWidth: LAYOUT_CONSTANTS.DEFAULT_DIALOG_WIDTH,
  dialogHeight: LAYOUT_CONSTANTS.DEFAULT_DIALOG_HEIGHT,
  detailsWidth: LAYOUT_CONSTANTS.DEFAULT_DETAILS_WIDTH,
  detailsHeight: LAYOUT_CONSTANTS.DEFAULT_DETAILS_HEIGHT,
  detailsVisible: false,
};

let spanViews = createSpanBuffer(
  DEFAULT_SPAN_CAPACITY,
  DEFAULT_STRING_CAPACITY
);
let stringOffset = 0;
let startingSpanId: SpanId | null = null;
const payloadByIndex = new Map<number, Record<string, unknown>>();

/** Convert spanId to buffer index using sequential ID scheme */
function spanIdToIndex(spanId: SpanId): number | undefined {
  if (startingSpanId === null) return undefined;
  const index = Number(spanId - startingSpanId);
  return index >= 0 && index < getSpansCount(spanViews) ? index : undefined;
}

function resetSpanStorage(): SpanBufferViews {
  spanViews = createSpanBuffer(DEFAULT_SPAN_CAPACITY, DEFAULT_STRING_CAPACITY);
  stringOffset = 0;
  startingSpanId = null;
  payloadByIndex.clear();
  return spanViews;
}

function ensureSpanCapacity(nameByteLength: number): void {
  const count = getSpansCount(spanViews);
  const needsCapacity = count >= spanViews.capacity;
  const needsStrings =
    stringOffset + nameByteLength > spanViews.stringBytes.length;
  if (!needsCapacity && !needsStrings) return;
  const nextCapacity = needsCapacity
    ? Math.ceil(spanViews.capacity * 1.5)
    : spanViews.capacity;
  const nextStringCapacity = needsStrings
    ? Math.max(spanViews.stringBytes.length * 2, stringOffset + nameByteLength)
    : spanViews.stringBytes.length;
  spanViews = cloneSpanBuffer(spanViews, nextCapacity, nextStringCapacity);
}

function appendSpan(span: FlameGraphSpan): number {
  const nameByteLength = encoder.encode(span.name).length;
  ensureSpanCapacity(nameByteLength);
  const index = getSpansCount(spanViews);

  // Track starting spanId for index calculation
  if (startingSpanId === null) {
    startingSpanId = span.spanId;
  }

  spanViews.startTime[index] = span.startTime;
  spanViews.endTime[index] = span.endTime;
  spanViews.depth[index] = span.depth;
  spanViews.status[index] = STATUS_TO_CODE[span.status];
  spanViews.color[index] = span.color ? COLOR_TO_CODE[span.color] : 0;
  spanViews.parentIndex[index] =
    span.parentSpanId != null ? spanIdToIndex(span.parentSpanId) ?? -1 : -1;
  writeSpanId(spanViews, index, span.spanId);
  stringOffset = encodeName(spanViews, index, span.name, stringOffset);
  Atomics.store(spanViews.count, 0, index + 1);
  bumpSpanVersion(spanViews);
  if (span.payload) {
    payloadByIndex.set(index, span.payload);
  }
  return index;
}

function updateSpanEnd(
  spanId: SpanId,
  endTime: number,
  status: SpanState
): void {
  const index = spanIdToIndex(spanId);
  if (index === undefined) return;
  spanViews.endTime[index] = endTime;
  spanViews.status[index] = STATUS_TO_CODE[status];
  bumpSpanVersion(spanViews);
}

function getSpanView(index: number | null): FlameGraphSpan | null {
  if (index == null || index < 0) return null;
  const count = getSpansCount(spanViews);
  if (index >= count) return null;
  const statusCode = spanViews.status[index] as keyof typeof CODE_TO_STATUS;
  const colorCode = spanViews.color[index] as keyof typeof CODE_TO_COLOR;
  return {
    spanId: readSpanId(spanViews, index),
    parentSpanId:
      spanViews.parentIndex[index] >= 0
        ? readSpanId(spanViews, spanViews.parentIndex[index])
        : null,
    name: readSpanName(spanViews, index),
    startTime: spanViews.startTime[index],
    endTime: spanViews.endTime[index],
    duration: readDuration(spanViews, index),
    depth: spanViews.depth[index],
    status: CODE_TO_STATUS[statusCode],
    color: CODE_TO_COLOR[colorCode],
    payload: payloadByIndex.get(index),
  };
}

function getInitialState(): FlameGraphState {
  const layout = calculateLayout(DEFAULT_LAYOUT_CONFIG);
  return {
    spanBuffer: spanViews,
    spansCount: getSpansCount(spanViews),
    spanVersion: Atomics.load(spanViews.version, 0),
    totalSpansRecorded: 0,
    selectedSpanIndex: null,
    viewState: {
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      isOpen: false,
      isPipMode: false,
      height: 350,
      detailsPanel: {
        position: "bottom-right",
        open: false,
        height: 100,
        width: 100,
      },
      canvas: { width: 1000, height: 1000 },
      layout: DEFAULT_LAYOUT_CONFIG,
      calculatedLayout: layout,
    },
    isRecording: false,
    isOpen: false,
    isPipMode: false,
    height: 350,
  };
}

/**
 * Calculate layout dimensions for all flame graph components.
 * Single source of truth for all sizing and positioning.
 * Returns exact px values and CSS Grid configuration.
 */
export function calculateLayout(config: LayoutConfig): LayoutResult {
  const {
    dialogPosition,
    detailsPosition,
    dialogWidth,
    dialogHeight,
    detailsWidth,
    detailsHeight,
    detailsVisible,
  } = config;

  const {
    HEADER_HEIGHT,
    TIMELINE_HEADER_HEIGHT,
    STATUS_BAR_HEIGHT,
    MIN_CANVAS_WIDTH,
    MIN_CANVAS_HEIGHT,
    MIN_DIALOG_WIDTH,
    MIN_DIALOG_HEIGHT,
    MIN_DETAILS_WIDTH,
    MIN_DETAILS_HEIGHT,
  } = LAYOUT_CONSTANTS;

  const windowWidth = document.documentElement.clientWidth;
  const windowHeight = document.documentElement.clientHeight;
  const maxDialogWidth = Math.trunc(windowWidth * 0.9);
  const maxDialogHeight = Math.trunc(windowHeight * 0.9);

  // Calculate dialog dimensions and CSS position based on dialogPosition
  let dialogW: number;
  let dialogH: number;
  let dialogPos: { top: string; left: string; right: string; bottom: string };

  switch (dialogPosition) {
    case "left":
      dialogW = clamp(dialogWidth, MIN_DIALOG_WIDTH, maxDialogWidth);
      dialogH = windowHeight;
      dialogPos = { top: "0", left: "0", right: "auto", bottom: "0" };
      break;
    case "right":
      dialogW = clamp(dialogWidth, MIN_DIALOG_WIDTH, maxDialogWidth);
      dialogH = windowHeight;
      dialogPos = { top: "0", left: "auto", right: "0", bottom: "0" };
      break;
    case "bottom":
    default:
      dialogW = windowWidth;
      dialogH = clamp(dialogHeight, MIN_DIALOG_HEIGHT, maxDialogHeight);
      dialogPos = { top: "auto", left: "0", right: "0", bottom: "0" };
      break;
  }

  // Fixed heights
  const headerH = HEADER_HEIGHT;
  const statusBarH = STATUS_BAR_HEIGHT;

  // Content area height (between timeline header and status bar)
  const timelineHeaderH = TIMELINE_HEADER_HEIGHT;
  const contentH = dialogH - headerH - timelineHeaderH - statusBarH;

  // Calculate canvas and details dimensions based on detailsPosition
  let canvasW: number;
  let canvasH: number;
  let detailsW: number;
  let detailsH: number;
  let grid: GridConfig;

  if (!detailsVisible) {
    // No details - canvas takes full content area
    canvasW = dialogW;
    canvasH = Math.max(MIN_CANVAS_HEIGHT, contentH);
    detailsW = 0;
    detailsH = 0;

    grid = {
      templateAreas: `'header' 'timeline' 'canvas' 'statusbar'`,
      templateColumns: [dialogW],
      templateRows: [headerH, timelineHeaderH, canvasH, statusBarH],
    };
  } else {
    // Details visible - layout depends on detailsPosition
    const effectiveDetailsW = Math.max(
      MIN_DETAILS_WIDTH,
      Math.min(detailsWidth, dialogW * 0.75)
    );
    const effectiveDetailsH = Math.max(
      MIN_DETAILS_HEIGHT,
      Math.min(detailsHeight, contentH * 0.75)
    );

    switch (detailsPosition) {
      case "left":
        // Details on left spans timeline+canvas rows, timeline above canvas on right
        detailsW = effectiveDetailsW;
        detailsH = contentH + timelineHeaderH;
        canvasW = Math.max(MIN_CANVAS_WIDTH, dialogW - detailsW);
        canvasH = contentH;

        grid = {
          templateAreas: `'header header' 'details timeline' 'details canvas' 'statusbar statusbar'`,
          templateColumns: [detailsW, canvasW],
          templateRows: [headerH, timelineHeaderH, canvasH, statusBarH],
        };
        break;

      case "right":
        // Details on right spans timeline+canvas rows, timeline above canvas on left
        detailsW = effectiveDetailsW;
        detailsH = contentH + timelineHeaderH;
        canvasW = Math.max(MIN_CANVAS_WIDTH, dialogW - detailsW);
        canvasH = contentH;

        grid = {
          templateAreas: `'header header' 'timeline details' 'canvas details' 'statusbar statusbar'`,
          templateColumns: [canvasW, detailsW],
          templateRows: [headerH, timelineHeaderH, canvasH, statusBarH],
        };
        break;

      case "bottom":
      default:
        detailsW = dialogW;
        detailsH = effectiveDetailsH;
        canvasW = dialogW;
        canvasH = Math.max(MIN_CANVAS_HEIGHT, contentH - detailsH);

        grid = {
          templateAreas: `'header' 'timeline' 'canvas' 'details' 'statusbar'`,
          templateColumns: [dialogW],
          templateRows: [
            headerH,
            timelineHeaderH,
            canvasH,
            detailsH,
            statusBarH,
          ],
        };
        break;
    }
  }

  // Calculate top positions (vertical stacking within dialog)
  const headerTop = 0;
  const timelineTop = headerTop + headerH;
  const contentTop = timelineTop + timelineHeaderH;
  const statusBarTop = dialogH - statusBarH;

  // Calculate canvas, timeline, and details left/top based on position
  let canvasLeft = 0;
  let canvasTop = contentTop;
  let detailsLeft = 0;
  let detailsTop = contentTop;
  let timelineLeft = 0;
  let timelineW = dialogW;
  // Timeline height spans header + canvas for grid line rendering
  let timelineFullH = timelineHeaderH + canvasH;

  if (detailsVisible) {
    switch (detailsPosition) {
      case "left":
        // Details on left (spans timeline+canvas rows), timeline+canvas on right
        detailsLeft = 0;
        detailsTop = timelineTop;
        canvasLeft = detailsW;
        canvasTop = contentTop;
        timelineLeft = detailsW;
        timelineW = canvasW;
        break;
      case "right":
        // Timeline+canvas on left, details on right (spans timeline+canvas rows)
        canvasLeft = 0;
        canvasTop = contentTop;
        detailsLeft = canvasW;
        detailsTop = timelineTop;
        timelineLeft = 0;
        timelineW = canvasW;
        break;
      case "bottom":
      default:
        // Timeline full width, canvas above, details below
        canvasLeft = 0;
        canvasTop = contentTop;
        detailsLeft = 0;
        detailsTop = contentTop + canvasH;
        timelineLeft = 0;
        timelineW = dialogW;
        break;
    }
  }

  return {
    dialog: {
      left: 0,
      top: 0,
      width: dialogW,
      height: dialogH,
      position: dialogPos,
    },
    grid,
    header: { left: 0, top: headerTop, width: dialogW, height: headerH },
    timeline: {
      left: timelineLeft,
      top: timelineTop,
      width: timelineW,
      height: timelineFullH, // Full height: header + canvas for grid lines
    },
    canvas: {
      left: canvasLeft,
      top: canvasTop,
      width: canvasW,
      height: canvasH,
    },
    details: {
      left: detailsLeft,
      top: detailsTop,
      width: detailsW,
      height: detailsH,
      visible: detailsVisible,
    },
    statusBar: {
      left: 0,
      top: statusBarTop,
      width: dialogW,
      height: statusBarH,
    },
  };
}

export const selectors = {
  spanBuffer: (s: FlameGraphState) => s.spanBuffer,
  spansCount: (s: FlameGraphState) => s.spansCount,
  spanVersion: (s: FlameGraphState) => s.spanVersion,
  totalSpansRecorded: (s: FlameGraphState) => s.totalSpansRecorded,
  hasSpans: (s: FlameGraphState) => s.spansCount > 0,
  selectedSpanIndex: (s: FlameGraphState) => s.selectedSpanIndex,
  selectedSpan: (s: FlameGraphState) => getSpanView(s.selectedSpanIndex),
  timeRange: (s: FlameGraphState): TimeRange => {
    const { spanBuffer, spansCount } = s;

    if (spansCount === 0) {
      return { minTime: 0, maxTime: 0 };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;
    let hasRunningSpans = false;

    for (let i = 0; i < spansCount; i++) {
      minTime = Math.min(minTime, spanBuffer.startTime[i]);

      if (hasRunningSpans) {
        continue;
      }
      if (spanBuffer.status[i] === 1) {
        hasRunningSpans = true;
        maxTime = performance.now();
      } else {
        maxTime = Math.max(maxTime, spanBuffer.endTime[i]);
      }
    }

    return { minTime, maxTime };
  },
  totalDuration: (s: FlameGraphState) => {
    const { minTime, maxTime } = selectors.timeRange(s);
    return maxTime - minTime;
  },
  maxZoom: (s: FlameGraphState) => {
    const duration = selectors.totalDuration(s);
    return duration > 0
      ? Math.min(duration / MIN_VISIBLE_DURATION_MS, MAX_SAFE_ZOOM)
      : MAX_SAFE_ZOOM;
  },
  viewState: (s: FlameGraphState) => s.viewState,
  isRecording: (s: FlameGraphState) => s.isRecording,
  isOpen: (s: FlameGraphState) => s.isOpen,
  isPipMode: (s: FlameGraphState) => s.isPipMode,
  height: (s: FlameGraphState) => s.height,
  zoom: (s: FlameGraphState) => s.viewState.zoom,
  offsetX: (s: FlameGraphState) => s.viewState.offsetX,
  offsetY: (s: FlameGraphState) => s.viewState.offsetY,
  /** Pan/zoom state for rendering - only triggers on zoom/offset changes */
  panZoom: (s: FlameGraphState) => ({
    zoom: s.viewState.zoom,
    offsetX: s.viewState.offsetX,
    offsetY: s.viewState.offsetY,
  }),
  zoomPercent: (s: FlameGraphState) => Math.round(s.viewState.zoom * 100),
  maxDepth: (s: FlameGraphState) => {
    const count = s.spansCount;
    if (count === 0) return 0;
    const buffer = s.spanBuffer;
    let max = 0;
    for (let i = 0; i < count; i++) {
      if (buffer.depth[i] > max) max = buffer.depth[i];
    }
    return max;
  },
  layout: (s: FlameGraphState) => s.viewState.layout,
  calculatedLayout: (s: FlameGraphState) => s.viewState.calculatedLayout,
  timelineLayout: (s: FlameGraphState) => s.viewState.calculatedLayout.timeline,
  canvasLayout: (s: FlameGraphState) => s.viewState.calculatedLayout.canvas,
  detailsLayout: (s: FlameGraphState) => s.viewState.calculatedLayout.details,
  statusBarLayout: (s: FlameGraphState) =>
    s.viewState.calculatedLayout.statusBar,
  gridLayout: (s: FlameGraphState) => s.viewState.calculatedLayout.grid,
  headerLayout: (s: FlameGraphState) => s.viewState.calculatedLayout.header,
  dialogLayout: (s: FlameGraphState) => s.viewState.calculatedLayout.dialog,
  dialogPosition: (s: FlameGraphState) => s.viewState.layout.dialogPosition,
  dialogWidth: (s: FlameGraphState) => s.viewState.layout.dialogWidth,
  dialogHeight: (s: FlameGraphState) => s.viewState.layout.dialogHeight,
  detailsPosition: (s: FlameGraphState) => s.viewState.layout.detailsPosition,
  detailsWidth: (s: FlameGraphState) => s.viewState.layout.detailsWidth,
  detailsHeight: (s: FlameGraphState) => s.viewState.layout.detailsHeight,
  detailsVisible: (s: FlameGraphState) => s.viewState.layout.detailsVisible,
  layoutToDOMRect: (dimensions: ComponentDimensions) => {
    const { left, top, width, height } = dimensions;
    return new DOMRectReadOnly(left, top, width, height);
  },
  getHandlePosition: (position: Position): HandlePosition => {
    switch (position) {
      case "left":
        return "right";
      case "right":
        return "left";
      case "bottom":
        return "top";
      default:
        return "bottom";
    }
  },
} as const;

function createActions(store: StoreApi<FlameGraphState>) {
  const { getState, setState, batch } = store;

  return {
    // Spans
    addSpan(span: FlameGraphSpan) {
      appendSpan(span);
      setState((s) => ({
        spanBuffer: spanViews,
        spansCount: s.spansCount + 1,
        spanVersion: Atomics.load(spanViews.version, 0),
      }));
    },

    /** Start a span (adds with status: "running") */
    startSpan(span: FlameGraphSpan) {
      if (spanIdToIndex(span.spanId) !== undefined) return;
      appendSpan({ ...span, status: "running" });
      setState((s) => ({
        spanBuffer: spanViews,
        spansCount: s.spansCount + 1,
        spanVersion: Atomics.load(spanViews.version, 0),
      }));
    },

    /** End a running span (updates status and duration) */
    endSpan(spanId: SpanId, endTime: number, status: SpanState = "success") {
      updateSpanEnd(spanId, endTime, status);
      setState({
        spanVersion: Atomics.load(spanViews.version, 0),
      });
    },

    /** Remove a span by ID */
    removeSpan(spanId: SpanId) {
      // Append-only storage: span removal is not supported.
      if (spanIdToIndex(spanId) !== undefined) {
        setState({
          spanVersion: Atomics.load(spanViews.version, 0),
        });
      }
    },

    // Selection
    selectSpan(spanIndex: number | null) {
      const showDetails = spanIndex !== null;
      setState((s) => ({
        selectedSpanIndex: spanIndex,
        viewState: {
          ...s.viewState,
          layout: { ...s.viewState.layout, detailsVisible: showDetails },
        },
      }));
      this.recalculateLayout();
    },

    // View
    setViewState(viewState: Partial<FlameGraphViewState>) {
      setState((s) => ({
        viewState: { ...s.viewState, ...viewState },
      }));
    },

    /**
     * Apply zoom centered on a focus point.
     * @param zoomFactor - Multiplier for zoom (>1 = zoom in, <1 = zoom out)
     * @param focusX - X coordinate relative to content area (after padding)
     * @returns true if zoom was applied, false if at limits
     */
    applyZoom(zoomFactor: number, focusX: number): boolean {
      const state = getState();
      const { width } = state.viewState.calculatedLayout.canvas;
      const { viewState } = state;

      const availableWidth = width - CANVAS_PADDING_LEFT - CANVAS_PADDING_RIGHT;
      const minZoom = availableWidth / width;
      const maxZoom = selectors.maxZoom(state);

      // Calculate new zoom (clamped)
      const newZoom = Math.max(
        minZoom,
        Math.min(maxZoom, viewState.zoom * zoomFactor)
      );

      // If zoom didn't change (at limits), skip update
      if (Math.abs(newZoom - viewState.zoom) < 0.0001) {
        return false;
      }

      // Calculate new offsetX to keep focus point stable
      const scale = newZoom / viewState.zoom;
      const newOffsetX = focusX - (focusX - viewState.offsetX) * scale;

      // Clamp offsetX to pan bounds
      const isAtMinZoom = Math.abs(newZoom - minZoom) < 0.001;
      let clampedOffsetX: number;

      if (isAtMinZoom) {
        clampedOffsetX = 0;
      } else {
        const contentWidth = width * newZoom;
        const maxOffsetX = CANVAS_PAN_MARGIN_PX;
        const minOffsetX =
          width - contentWidth - CANVAS_PAN_MARGIN_PX - CANVAS_PADDING_LEFT;
        clampedOffsetX = Math.max(minOffsetX, Math.min(maxOffsetX, newOffsetX));
      }

      setState((s) => ({
        viewState: {
          ...s.viewState,
          zoom: isAtMinZoom ? minZoom : newZoom,
          offsetX: clampedOffsetX,
        },
      }));

      return true;
    },

    setHeight(height: number) {
      setState({ height });
    },

    // Recording
    startRecording() {
      setState({ isRecording: true });
      this.clearRecording();
    },

    stopRecording() {
      setState({ isRecording: false });
    },

    toggleRecording(): boolean {
      const next = !getState().isRecording;
      if (next) {
        this.startRecording();
      } else {
        this.stopRecording();
      }
      return next;
    },

    // Dialog
    open() {
      batch(() => {
        this.recalculateLayout();
        setState({ isOpen: true });
      });
    },

    close() {
      setState({ isOpen: false, isPipMode: false });
    },

    // PiP
    enterPip() {
      setState({ isPipMode: true });
    },

    exitPip() {
      setState({ isPipMode: false });
    },

    // Reset
    clearRecording() {
      resetSpanStorage();
      setState({
        spanBuffer: spanViews,
        spansCount: 0,
        spanVersion: Atomics.load(spanViews.version, 0),
        selectedSpanIndex: null,
      });
    },

    reset() {
      resetSpanStorage();
      setState(store.getInitialState(), true);
    },

    onResizeWindow() {
      this.recalculateLayout();
    },

    // Layout
    setDialogPosition(position: Position) {
      batch(() => {
        setState((s) => ({
          viewState: {
            ...s.viewState,
            layout: { ...s.viewState.layout, dialogPosition: position },
          },
        }));
        this.recalculateLayout();
      });
    },

    setDetailsPosition(position: Position) {
      batch(() => {
        setState((s) => ({
          viewState: {
            ...s.viewState,
            layout: { ...s.viewState.layout, detailsPosition: position },
          },
        }));
        this.recalculateLayout();
      });
    },

    resizeDialog(newWidth: number, newHeight: number) {
      const orientation = selectors.dialogPosition(getState());
      const maxWidth = document.documentElement.clientWidth * 0.9;
      const maxHeight = document.documentElement.clientHeight * 0.9;
      const nextLayout = () => {
        if (orientation === "left" || orientation === "right") {
          return {
            dialogWidth: clamp(
              newWidth,
              LAYOUT_CONSTANTS.MIN_DIALOG_WIDTH,
              maxWidth
            ),
          };
        }
        return {
          dialogHeight: clamp(
            newHeight,
            LAYOUT_CONSTANTS.MIN_DIALOG_HEIGHT,
            maxHeight
          ),
        };
      };

      batch(() => {
        setState((s) => ({
          viewState: {
            ...s.viewState,
            layout: {
              ...s.viewState.layout,
              ...nextLayout(),
            },
          },
        }));

        this.recalculateLayout();
      });
    },

    resizeDetails(newWidth: number, newHeight: number) {
      const orientation = getState().viewState.layout.detailsPosition;
      const nextLayout = () => {
        if (orientation === "left" || orientation === "right") {
          return {
            detailsWidth: Math.max(
              LAYOUT_CONSTANTS.MIN_DETAILS_WIDTH,
              newWidth
            ),
          };
        }
        return {
          detailsHeight: Math.max(
            LAYOUT_CONSTANTS.MIN_DETAILS_HEIGHT,
            newHeight
          ),
        };
      };
      batch(() => {
        setState((s) => ({
          viewState: {
            ...s.viewState,
            layout: {
              ...s.viewState.layout,
              ...nextLayout(),
            },
          },
        }));
        this.recalculateLayout();
      });
    },

    setDetailsVisible(visible: boolean) {
      batch(() => {
        setState((s) => ({
          viewState: {
            ...s.viewState,
            layout: { ...s.viewState.layout, detailsVisible: visible },
          },
        }));
        this.recalculateLayout();
      });
    },

    recalculateLayout() {
      const layout = selectors.layout(getState());
      const calculatedLayout = calculateLayout(layout);
      setState((s) => ({
        viewState: {
          ...s.viewState,
          calculatedLayout,
        },
      }));
    },
  };
}

const store = createStore(getInitialState);
const actions = createActions(store);

// Public API: store + actions + selectors
export const flameGraphState = {
  getState: store.getState,
  subscribe: store.subscribe,
  ...actions,
  selectors,
};
