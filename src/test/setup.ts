import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Suppress unhandled rejection warnings for rejected promises in tests
// These are intentional when testing error handling
if (typeof process !== "undefined" && process.on) {
  process.on("unhandledRejection", () => {
    // Intentionally empty - we're testing error handling
  });
}
