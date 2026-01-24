import { useRef, useTransition } from "react";

export type TabId = "custom" | "tanstack" | "rsc" | "unset";

/**
 * Tab selector component for switching between implementations
 */
export function TabSelector({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const tabChangeRef = useRef<Exclude<TabId, "unset"> | null>(null);

  const handleTabChange = (tab: Exclude<TabId, "unset">) => {
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

  const tabs: { id: Exclude<TabId, "unset">; label: string }[] = [
    { id: "rsc", label: "RSC" },
    { id: "custom", label: "Custom" },
    { id: "tanstack", label: "TanStack" },
  ];

  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex rounded-4xl [corner-shape:superellipse(1.33)] border border-gray-200 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            disabled={activeTab === "unset"}
            onClick={() => handleTabChange(tab.id)}
            className={`px-6 py-2 rounded-4xl [corner-shape:superellipse(1.33)] text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-black text-white shadow-md"
                : "text-gray-600 hover:text-black"
            } ${isPending && "opacity-50 pointer-events-none"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
