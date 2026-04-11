import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver for jsdom (used by Radix UI components)
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
