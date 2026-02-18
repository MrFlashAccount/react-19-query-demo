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

export function setAutoClientManifest(manifest: ClientManifest): void {
  getManifestStore()[CLIENT_MANIFEST_GLOBAL_KEY] = manifest;
}

function ensureManifestMap(): Record<
  string,
  { id: string; name: string; chunks: string[]; async?: boolean }
> {
  const store = getManifestStore();
  const current = store[CLIENT_MANIFEST_GLOBAL_KEY];
  if (typeof current === "object" && current != null) {
    return current as Record<
      string,
      { id: string; name: string; chunks: string[]; async?: boolean }
    >;
  }

  const manifestMap: Record<
    string,
    { id: string; name: string; chunks: string[]; async?: boolean }
  > = {};
  store[CLIENT_MANIFEST_GLOBAL_KEY] = manifestMap;
  return manifestMap;
}

export function registerAutoClientManifestEntry(moduleId: string, name: string = "*"): void {
  const manifest = ensureManifestMap();
  const key = `${moduleId}#${name}`;
  if (manifest[key] != null) {
    return;
  }

  manifest[key] = {
    id: moduleId,
    name,
    chunks: [],
    async: false,
  };
}

export function resolveClientManifestOrThrow(manifest?: ClientManifest): ClientManifest {
  if (manifest != null) {
    return manifest;
  }

  const autoManifest = getAutoClientManifest();
  if (typeof autoManifest === "object" && autoManifest != null) {
    return autoManifest;
  }

  if (typeof autoManifest === "string" && autoManifest.length > 0) {
    return autoManifest;
  }

  return DEFAULT_CLIENT_MANIFEST_BASE_URL;
}

declare global {
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __RSC_PRISM_CLIENT_MANIFEST__: ClientManifest | undefined;
}
