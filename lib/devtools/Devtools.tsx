import { useDebugValue, useEffect, useLayoutEffect, useRef } from "react";
import { useQueryContext } from "../react/QueryProvider";
import { useDebugFormattedQuery } from "./useDebugFormattedQuery";
import {
  tracer,
  Tracer,
  setupTracer,
  FlameGraphReporter,
  LoggerReporter,
  DevtoolsReporter,
  type LoggerReporterOptions,
  type DevtoolsReporterOptions,
} from "../tracing";
import { createPortal } from "react-dom";

setupTracer(new Tracer());

export interface QueryLoggerProps {
  options?: LoggerReporterOptions;
}

export function QueryLogger({ options }: QueryLoggerProps) {
  useEffect(() => {
    const reporter = new LoggerReporter(options);
    const unregister = tracer.addReporter(reporter);
    reporter.start();
    return () => {
      reporter.stop();
      unregister();
    };
  }, [options]);

  return null;
}

export interface QueryPerformanceTrackerProps {
  options?: DevtoolsReporterOptions;
}

export function QueryPerformanceTracker({
  options,
}: QueryPerformanceTrackerProps) {
  useEffect(() => {
    const reporter = new DevtoolsReporter({
      prefix: "goat-query",
      trackGroupName: "🐐 Query",
      trackName: "Timeline",
      ...options,
    });
    const unregister = tracer.addReporter(reporter);
    reporter.start();
    return () => {
      reporter.stop();
      unregister();
    };
  }, [options]);

  return null;
}

export function QueryFlameGraph() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current == null) return;

    console.log("mounting flame graph", ref.current);
    const flameGraph = new FlameGraphReporter({});
    flameGraph.mount(ref.current);
    const unregister = tracer.addReporter(flameGraph);

    return () => {
      console.log("unmounting flame graph");
      flameGraph.unmount();
      unregister();
    };
  }, []);

  return createPortal(<div ref={ref} />, document.body);
}

export interface QueryDevtoolsProps {
  disableLogger?: boolean;
  disablePerformanceTracker?: boolean;
  disableFlameGraph?: boolean;
}

export function QueryDevtools({
  disableLogger = false,
  disablePerformanceTracker = false,
  disableFlameGraph = false,
}: QueryDevtoolsProps) {
  const { queryClient } = useQueryContext();

  useDebugValue(useDebugFormattedQuery(queryClient));

  return (
    <>
      {!disablePerformanceTracker && <QueryPerformanceTracker />}
      {!disableLogger && <QueryLogger />}
      {!disableFlameGraph && <QueryFlameGraph />}
    </>
  );
}
