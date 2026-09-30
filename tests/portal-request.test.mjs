import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, after } from "node:test";
import ts from "typescript";

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { fetchPortalJson, PortalRequestError } = await loadModule("../lib/portal-request.ts");
const cache = await loadModule("../lib/portal-cache.ts");
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; cache.clearPortalCache(); });

test("successful empty arrays are valid; requests never use an HTTP cache", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.cache, "no-store");
    return Response.json({ success: true, members: [] });
  };
  const result = await fetchPortalJson("https://test.invalid", { arrayField: "members" });
  assert.deepEqual(result.members, []);
});

test("upstream outages and invalid JSON can be retried", async () => {
  for (const response of [
    Response.json({ success: false }, { status: 503 }),
    new Response("<html>unavailable</html>", { status: 502 }),
    new Response("<html>invalid</html>", { status: 200 }),
  ]) {
    globalThis.fetch = async () => response;
    await assert.rejects(fetchPortalJson("https://test.invalid"), e => e instanceof PortalRequestError && e.retryable);
  }
});

test("permission failures never trigger an automatic retry, including HTML responses", async () => {
  for (const status of [401, 403]) {
    for (const response of [Response.json({ message: "권한 없음" }, { status }), new Response("forbidden", { status })]) {
      globalThis.fetch = async () => response;
      await assert.rejects(fetchPortalJson("https://test.invalid"), e => !e.retryable && e.status === status);
    }
  }
});

test("configuration failures explicitly opt out of retries", async () => {
  globalThis.fetch = async () => Response.json({ success: false, retryable: false }, { status: 500 });
  await assert.rejects(fetchPortalJson("https://test.invalid"), e => !e.retryable);
});

test("partial successful payloads are not mistaken for an empty list", async () => {
  globalThis.fetch = async () => Response.json({ success: true });
  await assert.rejects(fetchPortalJson("https://test.invalid", { arrayField: "rows" }), e => e.retryable);
});

test("ambiguous nicknames and no matches are domain results rather than outages", async () => {
  globalThis.fetch = async () => Response.json({ success: false, multiple: true, candidates: ["밍쨩", "민짜"] });
  const data = await fetchPortalJson("https://test.invalid", { allowDomainFailure: true, arrayField: "items" });
  assert.equal(data.candidates.length, 2);
});

test("the deadline also cancels a stalled response body", async () => {
  globalThis.fetch = async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
    },
  }));
  await assert.rejects(fetchPortalJson("https://test.invalid", { timeoutMs: 20 }), e => e.retryable && /늦어/.test(e.message));
});

test("unmount/query-change cancellation reaches the transport", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  const request = fetchPortalJson("https://test.invalid", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, e => e.name === "AbortError");
});

test("cache is isolated by account and query and cleared on access loss", () => {
  cache.writePortalCache("account-a\n/guild", { count: 1 }, Date.now());
  cache.writePortalCache("account-a\n/distribution?nickname=밍쨩", { count: 2 }, Date.now());
  cache.writePortalCache("account-b\n/guild", { count: 3 }, Date.now());
  assert.equal(cache.readPortalCache("account-a\n/distribution?nickname=민짜"), undefined);
  cache.clearPortalCache("account-a");
  assert.equal(cache.readPortalCache("account-a\n/guild"), undefined);
  assert.equal(cache.readPortalCache("account-b\n/guild").data.count, 3);
});

test("old cache entries expire and cache size remains bounded", () => {
  cache.writePortalCache("old", {}, Date.now() - 301000);
  assert.equal(cache.readPortalCache("old"), undefined);
  for (let i = 0; i < 31; i++) cache.writePortalCache(`entry-${i}`, {}, Date.now());
  assert.equal(cache.readPortalCache("entry-0"), undefined);
  assert.ok(cache.readPortalCache("entry-30"));
});
