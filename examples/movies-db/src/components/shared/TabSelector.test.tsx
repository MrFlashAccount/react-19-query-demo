import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TabSelector } from "./TabSelector";

describe("TabSelector", () => {
  it("switches to unset immediately on click", () => {
    const onTabChange = vi.fn();

    render(<TabSelector activeTab="rsc" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(onTabChange).toHaveBeenCalledWith("unset");
  });
});
