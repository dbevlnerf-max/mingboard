"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { clearPortalCache, readPortalCache, writePortalCache } from "./portal-cache";
import { fetchPortalJson, PortalRequestError } from "./portal-request";

type Result = { success: boolean; message?: string; retryable?: boolean };
type Snapshot<T> = {
  key: string;
  data?: T;
  updatedAt?: number;
  refreshing: boolean;
  error: string;
  retrying: boolean;
  blocked: boolean;
  offline: boolean;
};

export function usePortalQuery<T extends Result>(
  url: string | null,
  { intervalMs = 30000, arrayField, allowDomainFailure = false }: {
    intervalMs?: number;
    arrayField?: string;
    allowDomainFailure?: boolean;
  } = {},
) {
  const { data: session, status } = useSession();
  const user = session?.user;
  const scope = user?.discordId ? JSON.stringify([
    user.discordId, user.isGuildMember, user.hasZeusRole, user.isAdmin,
    user.isMaster, user.linkedGid, user.characterStatus,
  ]) : "";
  const key = status === "authenticated" && scope && url ? `${scope}\n${url}` : "";
  const [snapshot, setSnapshot] = useState<Snapshot<T>>();
  const refreshRef = useRef<(() => void) | null>(null);
  const refresh = useCallback(() => refreshRef.current?.(), []);

  useEffect(() => {
    if (!key || !url) return;
    let disposed = false;
    let running = false;
    let blocked = false;
    let failures = 0;
    let lastAttempt = 0;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Snapshot<T> = {
      key, ...readPortalCache<T>(key), refreshing: false,
      error: "", retrying: false, blocked: false, offline: !navigator.onLine,
    };
    const publish = (patch: Partial<Snapshot<T>>) => {
      current = { ...current, ...patch };
      if (!disposed) setSnapshot(current);
    };
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    async function run() {
      if (disposed || running || blocked) return;
      clearTimeout(timer);
      if (!navigator.onLine) {
        publish({ refreshing: false, offline: true });
        schedule(intervalMs);
        return;
      }
      // Hidden tabs do not keep hitting Sheets. Returning to the tab resumes them.
      if (document.visibilityState === "hidden") {
        schedule(intervalMs);
        return;
      }
      running = true;
      lastAttempt = Date.now();
      controller = new AbortController();
      publish({ refreshing: true, offline: false });
      let delay = intervalMs;
      try {
        const data = await fetchPortalJson<T>(url!, {
          signal: controller.signal, arrayField, allowDomainFailure,
        });
        if (disposed) return;
        failures = 0;
        const updatedAt = Date.now();
        writePortalCache(key, data, updatedAt);
        publish({ data, updatedAt, error: "", retrying: false });
      } catch (error) {
        if (disposed) return;
        const problem = error instanceof PortalRequestError
          ? error : new PortalRequestError("데이터를 확인하지 못했습니다.");
        blocked = !problem.retryable;
        if (problem.status === 401 || problem.status === 403) {
          clearPortalCache(scope);
          publish({ data: undefined, updatedAt: undefined });
        }
        failures += 1;
        delay = failures === 1 ? 1200 : failures === 2 ? 3000 : intervalMs;
        publish({ error: problem.message, retrying: !blocked, blocked });
      } finally {
        running = false;
        if (!disposed) {
          publish({ refreshing: false });
          if (!blocked) schedule(delay);
        }
      }
    }

    const resume = () => {
      if (document.visibilityState !== "hidden" && Date.now() - lastAttempt > 5000) void run();
    };
    const offline = () => publish({ offline: true });
    const online = () => { void run(); };
    refreshRef.current = () => {
      blocked = false;
      failures = 0;
      void run();
    };
    // Defer the first state update and allow StrictMode cleanup to cancel it.
    schedule(0);
    window.addEventListener("focus", resume);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      refreshRef.current = null;
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [key, url, scope, intervalMs, arrayField, allowDomainFailure]);

  const current = snapshot?.key === key ? snapshot : undefined;
  const cached = key && !current?.blocked ? readPortalCache<T>(key) : undefined;
  const data = current?.data ?? (cached ? cached.data : undefined);
  return {
    data,
    loading: Boolean(key && !data && !current?.error),
    refreshing: current?.refreshing ?? Boolean(key),
    error: current?.error ?? "",
    retrying: current?.retrying ?? false,
    offline: current?.offline ?? false,
    updatedAt: current?.updatedAt ?? (cached ? cached.updatedAt : undefined),
    refresh,
  };
}
