import { useDebugValue, useEffect } from "react";
import { Logger } from "./Logger";
import { Measurer } from "./Measurer";
import { useQueryContext } from "../react/QueryProvider";
import { useDebugFormattedQuery } from "./useDebugFormattedQuery";

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
  const { queryClient } = useQueryContext();

  useDebugValue(useDebugFormattedQuery(queryClient));

  return (
    <>
      {!disableMeasurer && <QueryPerformanceTracker />}
      {!disableLogger && <QueryLogger />}
    </>
  );
}
