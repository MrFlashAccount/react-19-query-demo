import type { QueryClient } from "@tanstack/react-query";
import type { Api } from "../../types/api";

export interface TabProps extends SettingsProps {
  devtools: React.ComponentType<{ client: QueryClient }> | null;
  api: Api;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export interface SettingsProps {
  gcTimeout: number;
  onGcTimeoutChange: (timeout: number) => void;
  movieLimit: number;
  onMovieLimitChange: (limit: number) => void;
  showDevtools: boolean;
  onShowDevtoolsChange: (show: boolean) => void;
}
