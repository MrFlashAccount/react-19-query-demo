import type { MovieApi } from "../../api/types";

export interface TabProps<
  DevtoolsProps extends Record<string, unknown> = Record<string, unknown>
> {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
  devtools: React.ComponentType<DevtoolsProps> | null;
  api: MovieApi;
}

export interface SettingsProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
}
