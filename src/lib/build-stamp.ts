// Per-build stamp inlined by vite.config.ts (`define.__BUILD_STAMP__`) into both
// the client and server bundles. Used to detect stale cached sessions.
declare const __BUILD_STAMP__: string | undefined;

export const BUILD_STAMP: string =
  typeof __BUILD_STAMP__ === "string" ? __BUILD_STAMP__ : "dev";
