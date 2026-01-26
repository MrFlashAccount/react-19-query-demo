import { useEffect, useRef, useState } from "react";
import { useQueryContext } from "@lib/goat-query/react";
import { statsQuery, serversQuery } from "@/queries";

/**
 * Hook to manage real-time updates with visibility-based polling
 */
export function useRealtimeUpdates(options: {
  enabled?: boolean;
  interval?: number;
  onUpdate?: () => void;
}) {
  const { enabled = true, interval = 5000, onUpdate } = options;
  const { queryClient } = useQueryContext();
  const [isVisible, setIsVisible] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    setIsVisible(!document.hidden);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isVisible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const update = async () => {
      // Invalidate key queries to trigger refetch
      await Promise.all([
        queryClient.invalidateQuery(statsQuery),
        queryClient.invalidateQuery(serversQuery),
      ]);
      setLastUpdated(new Date());
      onUpdate?.();
    };

    // Initial update
    void update();

    // Set up interval
    intervalRef.current = window.setInterval(() => {
      void update();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isVisible, interval, queryClient, onUpdate]);

  return { lastUpdated, isVisible };
}

/**
 * Format relative time for "last updated" indicator
 */
export function formatLastUpdated(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);

  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString();
}
