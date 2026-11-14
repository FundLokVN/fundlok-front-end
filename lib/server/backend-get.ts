import { headers } from "next/headers";

import { backendSecretHeaders } from "@/lib/backend-secret";
import { clientIpHeaders } from "@/lib/client-ip";

// Same default as proxy.ts, next.config.ts and middleware.service.ts: they all
// describe one hop, Next → FastAPI.
const API_BASE_URL = process.env.API_URL || "http://127.0.0.1:8000";

// A prefetch is an optimisation, never a dependency: past this the page renders
// without the data and the browser fetches it, exactly as it did before the
// prefetch existed. Kept short because the page streams behind it.
const PREFETCH_TIMEOUT_MS = 3000;

export type BackendGetResult<T> =
  { ok: true; status: number; data: T } | { ok: false; status: number | null };

/**
 * GET a FastAPI endpoint from a server component, as the signed-in visitor.
 *
 * Sends what the browser's own /api call would have carried through the proxy
 * rewrite: the visitor's cookies (the session), X-Backend-Secret and
 * X-Client-IP. Server components only — reads the incoming request via
 * next/headers, which proxy.ts has already updated with any refreshed session
 * cookies for this request.
 *
 * Never throws: a timeout, network error or non-2xx resolves to `ok: false`
 * so callers can fall back to fetching in the browser.
 */
export async function backendGet<T>(
  path: string,
): Promise<BackendGetResult<T>> {
  const requestHeaders = await headers();
  try {
    const response = await fetch(new URL(path, API_BASE_URL), {
      headers: {
        cookie: requestHeaders.get("cookie") ?? "",
        ...clientIpHeaders(requestHeaders),
        ...backendSecretHeaders(),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as T,
    };
  } catch {
    return { ok: false, status: null };
  }
}
