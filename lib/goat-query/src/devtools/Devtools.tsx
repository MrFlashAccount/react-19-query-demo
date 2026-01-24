import { useDebugValue, useEffect, useLayoutEffect } from "react";

import {
  tracer,
  Tracer,
  setupTracer,
  FlameGraphReporter,
  LoggerReporter,
  DevtoolsReporter,
  type LoggerReporterOptions,
  type DevtoolsReporterOptions,
} from "@lib/tracing";
import { useQueryContext } from "../react/QueryProvider";

import { useDebugFormattedQuery } from "./useDebugFormattedQuery";

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

export function QueryPerformanceTracker({ options }: QueryPerformanceTrackerProps) {
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
  useLayoutEffect(() => {
    const flameGraph = new FlameGraphReporter({});
    flameGraph.mount(document.body);
    const unregister = tracer.addReporter(flameGraph);

    return () => {
      flameGraph.unmount();
      unregister();
    };
  }, []);

  return null;
}

export interface QueryDevtoolsProps {
  disableLogger?: boolean;
  disablePerformanceTracker?: boolean;
  disableFlameGraph?: boolean;
}

export function QueryDevtools({
  disableLogger = true,
  disablePerformanceTracker = true,
  disableFlameGraph = false,
}: QueryDevtoolsProps): React.JSX.Element {
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
