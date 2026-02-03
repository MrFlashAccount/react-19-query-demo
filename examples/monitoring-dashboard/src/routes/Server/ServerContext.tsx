import type { Server } from "@/db/schema";
import { createContext, useContext } from "react";

export interface ServerContextValue {
  server: Server | null;
  servers: Server[];
  selectedIndex: number;
  selectServer: (index: number) => void;
  isLoading: boolean;
  range: string;
  onRangeChange?: (range: string) => void;
  refreshData: () => void;
  autoRefreshInterval: number | null;
  setAutoRefreshInterval: (interval: number | null) => void;
}

export const ServerContext = createContext<ServerContextValue | null>(null);

export function useServerContext() {
  const ctx = useContext(ServerContext);
  if (!ctx) {
    throw new Error("useServerContext must be used within ServerProvider");
  }
  return ctx;
}
