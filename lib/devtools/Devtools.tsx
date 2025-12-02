import { useEffect } from "react";
import { logger as defaultLogger, type Logger } from "./Logger";
import { measurer as defaultMeasurer, type Measurer } from "./Measurer";

export interface QueryLoggerProps {
  logger?: Logger;
}

export function QueryLogger({ logger = defaultLogger }: QueryLoggerProps) {
  useEffect(() => {
    if (logger !== undefined) {
      return logger.start();
    }
  }, [logger]);

  return null;
}

export interface QueryPerformanceTrackerProps {
  measurer?: Measurer;
}
export function QueryPerformanceTracker({
  measurer = defaultMeasurer,
}: QueryPerformanceTrackerProps) {
  useEffect(() => {
    if (measurer !== undefined) {
      return measurer.start();
    }
  }, [measurer]);

  return null;
}

export interface QueryDevtoolsProps {
  disableLogger?: boolean;
  disableMeasurer?: boolean;
}

export function QueryDevtools({
  disableLogger = false,
  disableMeasurer = false,
}: QueryDevtoolsProps) {
  return (
    <>
      {!disableMeasurer && <QueryPerformanceTracker />}
      {!disableLogger && <QueryLogger />}
    </>
  );
}
