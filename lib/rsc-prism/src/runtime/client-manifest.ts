import type { ClientManifest, ClientManifestEntry } from "../types";

const CLIENT_MANIFEST_GLOBAL_KEY = "__RSC_PRISM_CLIENT_MANIFEST__";

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

  const manifest: ClientManifest = {};
  store[CLIENT_MANIFEST_GLOBAL_KEY] = manifest;
  return manifest;
}

export function registerAutoClientManifestEntry(moduleId: string, name: string = "*"): void {
  const manifest = ensureAutoClientManifest();

  const moduleEntry: ClientManifestEntry = {
    id: moduleId,
    chunks: [],
    name: "*",
  };
  manifest[moduleId] = moduleEntry;

  if (name !== "*") {
    manifest[`${moduleId}#${name}`] = {
      id: moduleId,
      chunks: [],
      name,
    };
  }
}

export function resolveClientManifestOrThrow(manifest?: ClientManifest): ClientManifest {
  if (manifest != null) {
    return manifest;
  }

  const autoManifest = getAutoClientManifest();
  if (autoManifest != null && Object.keys(autoManifest).length > 0) {
    return autoManifest;
  }

  throw new Error(
    'Client manifest is required. Pass a manifest explicitly or use @lib/rsc-prism/vite with mode:"worker" for "use main"/"use client" modules.',
  );
}

declare global {
  // biome-ignore lint/style/noVar: <Global declaration requires var>
  var __RSC_PRISM_CLIENT_MANIFEST__: ClientManifest | undefined;
}
