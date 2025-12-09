import { useRef, useTransition } from "react";

/**
 * Tab selector component for switching between custom library, TanStack Query, local TanStack Query, and query-core comparison implementations
 */
export function TabSelector({
  activeTab,
  onTabChange,
}: {
  activeTab: "custom" | "tanstack" | "unset";
  onTabChange: (tab: "custom" | "tanstack" | "unset") => void;
}) {
  const [isPending, startTransition] = useTransition();
  const tabChangeRef = useRef<"custom" | "tanstack" | null>(null);

  const handleTabChange = (tab: "custom" | "tanstack") => {
    if (tabChangeRef.current === tab) {
      return;
    }
    tabChangeRef.current = tab;

    onTabChange("unset");

    startTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      startTransition(() => {
        onTabChange(tab);
      });
    });
  };

  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex rounded-4xl [corner-shape:superellipse(1.33)] border border-gray-200 p-1">
        <button
          disabled={activeTab === "unset"}
          onClick={() => handleTabChange("custom")}
          className={`px-6 py-2 rounded-4xl [corner-shape:superellipse(1.33)] text-sm font-medium transition-all duration-200 ${
            activeTab === "custom"
              ? "bg-black text-white shadow-md"
              : "text-gray-600 hover:text-black"
          } ${isPending && "opacity-50 pointer-events-none"}`}
        >
          Custom Library
        </button>

        <button
          disabled={activeTab === "unset"}
          onClick={() => handleTabChange("tanstack")}
          className={`px-6 py-2 rounded-4xl [corner-shape:superellipse(1.33)] text-sm font-medium transition-all duration-200 ${
            activeTab === "tanstack"
              ? "bg-black text-white shadow-md"
              : "text-gray-600 hover:text-black"
          } ${isPending && "opacity-50 pointer-events-none"}`}
        >
          TanStack Query
        </button>
      </div>
    </div>
  );
}
