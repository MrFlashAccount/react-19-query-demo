import { useId } from "react";
import type { SettingsProps } from "./types";

const MIN_LIMIT = 0;
const MAX_LIMIT = 2000;
const LIMIT_OPTIONS = [100, 250, 500, 1000, 1500, 2000];
const GC_OPTIONS = [0, 5 * 60 * 1000, Infinity];
const GC_OPTIONS_LABELS = ["0s", "5m", "∞"];

/**
 * Settings component for configuring movie display preferences
 */
export function Settings({ formState, onFormStateChange }: SettingsProps) {
  const movieLimit = Number(formState.get("movieLimit") ?? 0);
  const gcTimeout = Number(formState.get("gcTimeout") ?? 0);
  const showDevtools = formState.get("showDevtools") === "true";
  const showLagRadar = formState.get("showLagRadar") === "true";

  const popoverTarget = useId();

  const cloneFormData = (formData: FormData) => {
    const newFormData = new FormData();

    formData.forEach((value, key) => {
      newFormData.set(key, value);
    });

    return newFormData;
  };

  return (
    <div className="flex flex-none relative">
      <button
        type="button"
        popoverTarget={popoverTarget}
        popoverTargetAction="toggle"
        className="anchor/settings h-[48px] md:h-[52px] aspect-square px-3 rounded-4xl [corner-shape:superellipse(1.33)] border border-gray-200 hover:border-black focus:outline-none focus:border-black transition-all duration-200 bg-white text-gray-700"
        aria-label="Settings"
      >
        <svg
          className="w-5 h-5 m-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <div
        id={popoverTarget}
        popover="auto"
        className="anchored/settings anchored-bottom-span-right mt-2 bg-white rounded-4xl [corner-shape:superellipse(1.33)] shadow-xl border-1 border-gray-200 p-3 sm:p-4 z-50 [left:anchor(left)] [right:1rem] max-w-none sm:[right:auto] sm:w-[400px]"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            Settings
          </h3>
          <button
            type="button"
            popoverTarget={popoverTarget}
            popoverTargetAction="hide"
            className="text-gray-500 hover:text-gray-700 -mr-1"
            aria-label="Close settings"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="movie-limit"
              className="block text-xs sm:text-sm font-medium text-gray-700 mb-2"
            >
              Number of movies
            </label>
            <div className="flex items-center gap-2">
              <input
                id="movie-limit"
                name="movieLimit"
                type="range"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                defaultValue={movieLimit}
                className="flex-1 h-2 bg-gray-200 rounded-4xl [corner-shape:superellipse(1.33)] appearance-none cursor-pointer accent-black min-w-0"
              />
              <input
                name="movieLimit"
                type="number"
                min={MIN_LIMIT}
                max={MAX_LIMIT}
                defaultValue={movieLimit}
                className="w-16 sm:w-20 px-2 py-1 text-xs sm:text-sm border-2 border-gray-200 rounded-4xl [corner-shape:superellipse(1.33)] focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{MIN_LIMIT}</span>
              <span>{MAX_LIMIT}</span>
            </div>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {LIMIT_OPTIONS.map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => {
                    const newFormData = cloneFormData(formState);
                    newFormData.set("movieLimit", limit.toString());
                    onFormStateChange(newFormData);
                  }}
                  className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-4xl [corner-shape:superellipse(1.33)] transition-colors ${
                    movieLimit === limit
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex flex-col gap-2">
              <label className="flex flex-col text-xs sm:text-sm font-medium text-gray-700 w-full">
                GC Timeout
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={Infinity}
                  defaultValue={gcTimeout}
                  name="gcTimeout"
                  className="w-full mt-2 px-2 py-1 text-xs sm:text-sm border-2 border-gray-200 rounded-4xl [corner-shape:superellipse(1.33)] focus:outline-none focus:border-black"
                />
              </label>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {GC_OPTIONS.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      const newFormData = cloneFormData(formState);
                      newFormData.set("gcTimeout", option.toString());
                      onFormStateChange(newFormData);
                    }}
                    className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-4xl [corner-shape:superellipse(1.33)] transition-colors ${
                      gcTimeout === option
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {GC_OPTIONS_LABELS[index]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Devtools
            </label>
            <button
              type="button"
              onClick={() => {
                const newFormData = cloneFormData(formState);
                newFormData.set(
                  "showDevtools",
                  !showDevtools ? "true" : "false"
                );
                onFormStateChange(newFormData);
              }}
              className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-4xl [corner-shape:superellipse(1.33)] transition-colors ${
                showDevtools
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {showDevtools ? "Hide" : "Show"} Devtools
            </button>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Lag Radar
            </label>
            <button
              type="button"
              onClick={() => {
                const newFormData = cloneFormData(formState);
                newFormData.set(
                  "showLagRadar",
                  !showLagRadar ? "true" : "false"
                );
                onFormStateChange(newFormData);
              }}
              className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-4xl [corner-shape:superellipse(1.33)] transition-colors ${
                showLagRadar
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {showLagRadar ? "Hide" : "Show"} Lag Radar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
