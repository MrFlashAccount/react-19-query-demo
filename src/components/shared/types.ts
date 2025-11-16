import type { QueryClient } from "@tanstack/react-query";
import type { MovieApi } from "../../api/types";

export interface TabProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
  devtools: React.ComponentType<{ client: QueryClient }> | null;
  api: MovieApi;
}

export interface SettingsProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
}
