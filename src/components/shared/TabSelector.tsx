import { useRef, useTransition } from "react";

/**
 * Tab selector component for switching between custom library and TanStack Query implementations
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
    tabChangeRef.current = tab;

    onTabChange("unset");

    setTimeout(() => {
      startTransition(() => {
        onTabChange(tab);
      });
    }, 100);
  };

  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex rounded-xl border-2 border-gray-200 p-1 bg-gray-50">
        <button
          disabled={activeTab === "unset"}
          onClick={() => handleTabChange("custom")}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
