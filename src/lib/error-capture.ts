// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

const CHUNK_ERROR_RE =
  /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError|error loading dynamically imported module/i;

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { message?: unknown; name?: unknown };
  const msg = String(anyErr?.message ?? err);
  const name = String(anyErr?.name ?? "");
  return CHUNK_ERROR_RE.test(msg) || name === "ChunkLoadError";
}

/** Auto-recover from a stale-bundle situation by reloading the page once. */
export function tryRecoverFromChunkError(err: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadError(err)) return false;
  try {
    const KEY = "chunk-reload-once";
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    const now = Date.now();
    // Allow another auto-reload after 30s so future deploys also self-heal.
    if (last && now - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(now));
    // Best-effort cache nuke before reload.
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
    setTimeout(() => window.location.reload(), 50);
    return true;
  } catch {
    try { window.location.reload(); } catch {}
    return true;
  }
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => {
    const err = (event as ErrorEvent).error ?? event;
    record(err);
    tryRecoverFromChunkError(err);
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    record(reason);
    tryRecoverFromChunkError(reason);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
