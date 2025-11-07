import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * Set up MSW service worker for browser environment
 */
export const worker = setupWorker(...handlers);
