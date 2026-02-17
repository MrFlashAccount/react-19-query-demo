import type { ClientManifest } from "../types";

const CLIENT_MANIFEST_GLOBAL_KEY = "__RSC_PRISM_CLIENT_MANIFEST__";
const DEFAULT_CLIENT_MANIFEST_BASE_URL = "/";

type GlobalWithClientManifest = typeof globalThis & {
  __RSC_PRISM_CLIENT_MANIFEST__?: ClientManifest;
};

function getManifestStore(): GlobalWithClientManifest {
  return globalThis as GlobalWithClientManifest;
}

export function getAutoClientManifest(): ClientManifest | undefined {
  return getManifestStore()[CLIENT_MANIFEST_GLOBAL_KEY];
}

export function ensureAutoClientManifest(): ClientManifest {
  const store = getManifestStore();
  const existing = store[CLIENT_MANIFEST_GLOBAL_KEY];
  if (existing != null) {
    return existing;
  }

  const manifest: ClientManifest = DEFAULT_CLIENT_MANIFEST_BASE_URL;
  store[CLIENT_MANIFEST_GLOBAL_KEY] = manifest;
  return manifest;
}

export function setAutoClientManifest(baseURL: ClientManifest): void {
  getManifestStore()[CLIENT_MANIFEST_GLOBAL_KEY] = baseURL;
}

export function registerAutoClientManifestEntry(_moduleId: string, _name: string = "*"): void {
  // Kept for compatibility with generated code. ESM Flight only needs the base URL.
  ensureAutoClientManifest();
}

export function resolveClientManifestOrThrow(manifest?: ClientManifest): ClientManifest {
  if (manifest != null) {
    return manifest;
  }

  const autoManifest = getAutoClientManifest();
  if (typeof autoManifest === "string" && autoManifest.length > 0) {
    return autoManifest;
  }

  return DEFAULT_CLIENT_MANIFEST_BASE_URL;
}

declare global {
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __RSC_PRISM_CLIENT_MANIFEST__: ClientManifest | undefined;
}
