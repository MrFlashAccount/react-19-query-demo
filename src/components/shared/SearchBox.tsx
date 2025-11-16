import { useTransition } from "react";
import { Settings } from "./Settings";

export interface SearchBoxProps {
  formState: FormData;
  onFormStateChange: (formData: FormData) => void;
}

export function SearchBox({ formState, onFormStateChange }: SearchBoxProps) {
  const [isPending, startTransition] = useTransition();
  const searchQuery = String(formState.get("searchQuery") ?? "");
  const gcTimeout = Number(formState.get("gcTimeout") ?? 0);

  const setFormState = (newFormData: FormData) => {
    startTransition(() => {
      const clonedFormData = new FormData();

      formState.forEach((value, key) => {
        clonedFormData.set(key, value);
      });

      newFormData.forEach((value, key) => {
        clonedFormData.set(key, value);
      });

      onFormStateChange(clonedFormData);
    });
  };

  const gcTimeoutReadable = () => {
    if (gcTimeout === Infinity) return "forever";
    if (gcTimeout === 0) return "0 seconds";
    if (gcTimeout < 60_000) return "less than a minute";
    if (gcTimeout === 60_000) return "1 minute";
    return `${Math.ceil(gcTimeout / 60_000)} minutes`;
  };

  return (
    <div className="w-full max-w-6xl mb-6 md:mb-8">
      <form
        onChange={(e) => {
          setFormState(new FormData(e.currentTarget));
        }}
        className="relative max-w-3xl mx-auto flex items-center gap-3"
      >
        <Settings formState={formState} onFormStateChange={setFormState} />

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 md:pl-5 flex items-center pointer-events-none">
            <svg
              className="w-4 h-4 md:w-5 md:h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <input
            type="text"
            defaultValue={searchQuery}
            name="searchQuery"
            placeholder="Search by title, director, genre, or tags..."
            className="w-full pl-10 pr-4 py-2.5 md:pl-12 md:pr-5 md:py-3 text-base md:text-base border-[0.5px] border-gray-200 rounded-2xl [corner-shape:squircle] focus:outline-none focus:border-black transition-all duration-200 placeholder-gray-400"
          />

          <div
            className={`absolute inset-y-0 right-0 pr-3 md:pr-5 flex items-center ${
              isPending ? "" : "hidden"
            } transition-opacity duration-300`}
          >
            <div className="animate-spin h-4 w-4 md:h-5 md:w-5 border-2 border-gray-300 border-t-black rounded-full" />
          </div>
        </div>
      </form>

      <div className="mt-2 text-center text-xs text-gray-400">
        Cached for {gcTimeoutReadable()} after last view
      </div>
    </div>
  );
}
