import { useEffect } from "react";
import { Logger } from "./Logger";
import { Measurer } from "./Measurer";

export interface QueryLoggerProps {
  logger?: Logger;
}

export function QueryLogger(props: QueryLoggerProps) {
  const logger = props.logger ?? new Logger();

  useEffect(() => logger.start(), [logger]);

  return null;
}

export interface QueryPerformanceTrackerProps {
  measurer?: Measurer;
}
export function QueryPerformanceTracker(props: QueryPerformanceTrackerProps) {
  const measurer = props.measurer ?? new Measurer();

  useEffect(() => measurer.start(), [measurer]);

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
