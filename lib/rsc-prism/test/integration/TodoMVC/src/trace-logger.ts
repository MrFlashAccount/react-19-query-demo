import { DevtoolsReporter, LoggerReporter, type IEventReceiver } from "@lib/tracing";

const DISPOSE_KEY = "__todoMvcTraceReporterDispose";
const RSC_TRACER_KEY = "__rscPrismTracer";
const RETRY_TIMER_KEY = "__todoMvcTraceReporterRetryTimer";
const MAX_RETRY_ATTEMPTS = 200;

interface RSCTracerLike {
  addReporter(reporter: IEventReceiver): () => void;
}

type ReporterGlobalState = typeof globalThis & {
  [DISPOSE_KEY]?: () => void;
  [RSC_TRACER_KEY]?: RSCTracerLike;
  [RETRY_TIMER_KEY]?: ReturnType<typeof setTimeout>;
};

function resolveRealmLabel(): string {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "main";
  }

  if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    return "worker";
  }

  return "runtime";
}

function installTraceLogger(): void {
  const state = globalThis as ReporterGlobalState;
  state[DISPOSE_KEY]?.();

  const retryTimer = state[RETRY_TIMER_KEY];
  if (retryTimer != null) {
    clearTimeout(retryTimer);
    state[RETRY_TIMER_KEY] = undefined;
  }

  let retries = 0;
  const tryInstall = () => {
    const tracer = state[RSC_TRACER_KEY];
    if (tracer == null || typeof tracer.addReporter !== "function") {
      retries += 1;
      if (retries > MAX_RETRY_ATTEMPTS) {
        state[RETRY_TIMER_KEY] = undefined;
        return;
      }
      state[RETRY_TIMER_KEY] = setTimeout(tryInstall, 50);
      return;
    }

    const realm = resolveRealmLabel();
    const loggerReporter = new LoggerReporter({
      showPayloadDetails: true,
      showEndMetadata: false,
      useGrouping: true,
    });

    const devtoolsReporter = new DevtoolsReporter({
      prefix: `rsc-prism-todomvc-${realm}`,
      trackGroupName: "RSC Prism TodoMVC",
      trackName: realm,
    });

    const unregisterLogger = tracer.addReporter(loggerReporter);
    const unregisterDevtools = tracer.addReporter(devtoolsReporter);

    state[DISPOSE_KEY] = () => {
      unregisterLogger();
      unregisterDevtools();
      devtoolsReporter.clearAll();
    };

    state[RETRY_TIMER_KEY] = undefined;
  };

  tryInstall();
}

installTraceLogger();
