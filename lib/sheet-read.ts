import { NextResponse } from "next/server";
import { after } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";
import { fetchPortalJson, PortalRequestError } from "./portal-request";

type Payload = { success: boolean; message?: string; [key: string]: unknown };
type Snapshot = { payload: Payload; fetched_at: string };
let databaseUnavailableUntil = 0;
const refreshing = new Map<string, Promise<Snapshot>>();

function identity(scriptUrl: string, params: string) {
  return {
    guild_id: process.env.DISCORD_GUILD_ID || "",
    source_key: createHash("sha256").update(scriptUrl).digest("hex"),
    query_key: createHash("sha256").update(params).digest("hex"),
  };
}

function unavailable(error: { code?: string } | null) {
  if (!error) return;
  const missingSchema = ["PGRST205", "PGRST202", "42P01"].includes(error.code || "");
  databaseUnavailableUntil = Date.now() + (missingSchema ? 60000 : 10000);
}

async function saveSnapshot(scriptUrl: string, params: string, snapshot: Snapshot) {
  if (Date.now() < databaseUnavailableUntil || !process.env.DISCORD_GUILD_ID) return;
  try {
    const key = identity(scriptUrl, params);
    const { error } = await supabaseAdmin.rpc("store_portal_sheet_snapshot", {
      p_guild_id: key.guild_id, p_source_key: key.source_key, p_query_key: key.query_key,
      p_payload: snapshot.payload, p_fetched_at: snapshot.fetched_at,
      p_action: new URLSearchParams(params).get("action"),
    }).abortSignal(AbortSignal.timeout(1500));
    unavailable(error);
    if (error && databaseUnavailableUntil <= Date.now()) console.error("Snapshot save failed:", error.code);
  } catch { databaseUnavailableUntil = Date.now() + 10000; }
}

async function loadSnapshot(scriptUrl: string, params: string): Promise<(Snapshot & { invalidated_at: string | null }) | null> {
  if (Date.now() < databaseUnavailableUntil || !process.env.DISCORD_GUILD_ID) return null;
  const key = identity(scriptUrl, params);
  try {
    const { data, error } = await supabaseAdmin.from("portal_sheet_snapshots")
      .select("payload,fetched_at,invalidated_at")
      .eq("guild_id", key.guild_id).eq("source_key", key.source_key).eq("query_key", key.query_key)
      .abortSignal(AbortSignal.timeout(1500)).maybeSingle();
    unavailable(error);
    return error ? null : data;
  } catch { databaseUnavailableUntil = Date.now() + 10000; return null; }
}

async function refreshSnapshot(scriptUrl: string, params: string, arrayField: string): Promise<Snapshot> {
  const key = `${scriptUrl}\n${params}`;
  const current = refreshing.get(key);
  if (current) return current;
  const task = (async () => {
    const fetched_at = new Date().toISOString();
    const url = new URL(scriptUrl);
    new URLSearchParams(params).forEach((value, key) => url.searchParams.set(key, value));
    const payload = await fetchPortalJson<Payload>(url.toString(), {
      timeoutMs: 18000, allowDomainFailure: true, arrayField,
    });
    // Only a validated success becomes a shared snapshot. A failed upstream
    // response can never overwrite the last good data or poison the cache.
    if (!payload.success) throw new PortalRequestError(payload.message || "조회 결과를 확인하지 못했습니다.");
    const snapshot = { payload, fetched_at };
    await saveSnapshot(scriptUrl, params, snapshot);
    return snapshot;
  })();
  refreshing.set(key, task);
  try { return await task; } finally { refreshing.delete(key); }
}

const cachedSnapshot = unstable_cache(refreshSnapshot, ["portal-sheet-snapshot-v1"], {
  revalidate: 30, tags: ["portal-sheet-snapshots"],
});

function backgroundRefresh(scriptUrl: string, params: string, arrayField: string) {
  after(async () => {
    try { await refreshSnapshot(scriptUrl, params, arrayField); }
    catch { console.error("Background Sheet refresh temporarily unavailable"); }
  });
}

export function invalidatePortalSheetReads() {
  revalidateTag("portal-sheet-snapshots", "max");
  if (Date.now() < databaseUnavailableUntil || !process.env.DISCORD_GUILD_ID) return;
  after(async () => {
    try {
      const { error } = await supabaseAdmin.from("portal_sheet_snapshots")
        .update({ invalidated_at: new Date().toISOString() })
        .eq("guild_id", process.env.DISCORD_GUILD_ID!)
        .abortSignal(AbortSignal.timeout(1500));
      unavailable(error);
    } catch { /* Automatic revalidation remains available. */ }
  });
}

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
  fresh = false,
) {
  params.sort();
  const query = params.toString();
  // Personal search includes successful ambiguous/no-match domain responses;
  // retain the original endpoint semantics without caching a domain failure.
  if (params.get("action") === "search") {
    const url = new URL(scriptUrl);
    params.forEach((value, key) => url.searchParams.set(key, value));
    const existing = fresh ? null : await loadSnapshot(scriptUrl, query);
    if (existing?.payload?.success && Array.isArray(existing.payload[arrayField]) && Number.isFinite(Date.parse(existing.fetched_at))) {
      const stale = Boolean(existing.invalidated_at) || Date.now() - Date.parse(existing.fetched_at) > 30000;
      if (stale) backgroundRefresh(scriptUrl, query, arrayField);
      return { ...existing.payload, sourceUpdatedAt: existing.fetched_at, stale };
    }
    const fetched_at = new Date().toISOString();
    const payload = await fetchPortalJson<Payload>(url.toString(), { signal, timeoutMs: 18000, allowDomainFailure: true, arrayField });
    if (payload.success) {
      after(() => saveSnapshot(scriptUrl, query, { payload, fetched_at }));
      return { ...payload, sourceUpdatedAt: fetched_at, stale: false };
    }
    return payload;
  }
  const existing = fresh ? null : await loadSnapshot(scriptUrl, query);
  if (existing?.payload?.success && Array.isArray(existing.payload[arrayField]) && Number.isFinite(Date.parse(existing.fetched_at))) {
    const stale = Boolean(existing.invalidated_at) || Date.now() - Date.parse(existing.fetched_at) > 30000;
    if (stale) backgroundRefresh(scriptUrl, query, arrayField);
    return { ...existing.payload, sourceUpdatedAt: existing.fetched_at, stale };
  }
  const snapshot = fresh ? await refreshSnapshot(scriptUrl, query, arrayField)
    : await cachedSnapshot(scriptUrl, query, arrayField);
  return {
    ...snapshot.payload, sourceUpdatedAt: snapshot.fetched_at,
    stale: Date.now() - Date.parse(snapshot.fetched_at) > 30000,
  };
}

export function warmPortalSheets() {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  after(async () => {
    await Promise.allSettled([
      readSheet(scriptUrl, new URLSearchParams({ action: "guild" }), new AbortController().signal, "members"),
      readSheet(scriptUrl, new URLSearchParams({ action: "distributionList", startDate: today, endDate: today,
        category: "전체", sort: "latest", page: "1", pageSize: "20" }), new AbortController().signal, "rows"),
    ]);
  });
}

export function sheetReadError(error: unknown, message: string) {
  // Upstream HTML, URLs and internal errors stay out of user-facing responses.
  return sheetJson({
    success: false, message,
    retryable: error instanceof PortalRequestError ? error.retryable : true,
  }, 502);
}
