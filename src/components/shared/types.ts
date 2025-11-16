import type { QueryClient } from "@tanstack/react-query";
import type { Api } from "../../types/api";

export interface TabProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
  devtools: React.ComponentType<{ client: QueryClient }> | null;
  api: Api;
}

export interface SettingsProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
}
