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
  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex rounded-xl border-2 border-gray-200 p-1 bg-gray-50">
        <button
          onClick={() => onTabChange("custom")}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === "custom"
              ? "bg-black text-white shadow-md"
              : "text-gray-600 hover:text-black"
          }`}
        >
          Custom Library
        </button>
        <button
          onClick={() => onTabChange("tanstack")}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === "tanstack"
              ? "bg-black text-white shadow-md"
              : "text-gray-600 hover:text-black"
          }`}
        >
          TanStack Query
        </button>
      </div>
    </div>
  );
}
