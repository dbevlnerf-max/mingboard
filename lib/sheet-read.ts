import { NextResponse } from "next/server";
import { fetchPortalJson, PortalRequestError } from "./portal-request";

export function sheetJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}

export async function readSheet(
  scriptUrl: string,
  params: URLSearchParams,
  signal: AbortSignal,
  arrayField: string,
) {
  const url = new URL(scriptUrl);
  params.forEach((value, key) => url.searchParams.set(key, value));
  return fetchPortalJson<{ success: boolean; message?: string }>(url.toString(), {
    signal, timeoutMs: 18000, allowDomainFailure: true, arrayField,
  });
}

export function sheetReadError(error: unknown, message: string) {
  // Upstream HTML, URLs and internal errors stay out of user-facing responses.
  return sheetJson({
    success: false, message,
    retryable: error instanceof PortalRequestError ? error.retryable : true,
  }, 502);
}
