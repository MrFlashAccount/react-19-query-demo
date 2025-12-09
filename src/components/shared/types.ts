import type { MovieApi } from "../../api/types";

export interface TabProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
  devtools: boolean;
  api: MovieApi;
}

export interface SettingsProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
}
