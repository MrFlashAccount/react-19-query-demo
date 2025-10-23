import { useTransition } from "react";

/**
 * Tab selector component for switching between custom library and TanStack Query implementations
 */
export function TabSelector({
  activeTab,
  onTabChange,
}: {
  activeTab: "custom" | "tanstack";
  onTabChange: (tab: "custom" | "tanstack") => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (tab: "custom" | "tanstack") => {
    startTransition(() => {
      onTabChange(tab);
    });
  };

  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex rounded-xl border-2 border-gray-200 p-1 bg-gray-50">
        <button
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
