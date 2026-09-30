import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, after } from 'node:test';
import ts from 'typescript';
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { canReuseAccess, mergeVerifiedAccess, reuseAccess } = await load('../lib/access-policy.ts');
const { verifyDiscordAccess } = await load('../lib/discord-access.ts');
const now = 1000000;
const context = 'guild-role-master';
const discord = { verified: true, value: { isGuildMember: true, hasZeusRole: true, isAdmin: false } };
const character = { verified: true, value: { active: true, gid: '12', status: 'active' } };
const unavailable = { verified: false };
const granted = mergeVerifiedAccess({}, discord, character, context, false, now);
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

test('fresh verified access avoids repeating Discord and DB calls for 60 seconds', () => {
  assert.equal(canReuseAccess(granted, context, now + 59999), true);
  assert.equal(canReuseAccess(granted, context, now + 60000), false);
  assert.equal(canReuseAccess(granted, 'different-role-config', now + 1), false);
});
test('temporary Discord and DB failures preserve verified access without extending its verification age', () => {
  const next = mergeVerifiedAccess(granted, unavailable, unavailable, context, false, now + 61000);
  assert.equal(next.isGuildMember, true);
  assert.equal(next.hasActiveCharacterLink, true);
  assert.equal(next.authVerificationPending, false);
  assert.equal(next.authDegraded, true);
  assert.equal(next.discordVerifiedAt, now);
  assert.equal(next.characterVerifiedAt, now);
});
test('unverified first logins and changed configuration never grant access during an outage', () => {
  for (const previous of [{}, granted]) {
    const next = mergeVerifiedAccess(previous, unavailable, unavailable, 'new-config', false, now + 1);
    assert.equal(next.isGuildMember, false);
    assert.equal(next.hasActiveCharacterLink, false);
    assert.equal(next.authVerificationPending, true);
  }
});
test('confirmed removal and confirmed revoked character links take effect immediately', () => {
  const removed = mergeVerifiedAccess(granted, { verified: true, value: { isGuildMember: false, hasZeusRole: false, isAdmin: false } }, character, context, false, now + 1);
  assert.equal(removed.isGuildMember, false);
  assert.equal(removed.authVerificationPending, false);
  const revoked = mergeVerifiedAccess(granted, discord, { verified: true, value: { active: false, gid: null, status: null } }, context, false, now + 1);
  assert.equal(revoked.hasActiveCharacterLink, false);
  assert.equal(revoked.linkedGid, undefined);
  assert.equal(revoked.authVerificationPending, false);
});
test('a long Retry-After never extends the five-minute permission grace period', () => {
  const limited = mergeVerifiedAccess(granted, { verified: false, retryAt: now + 900000 }, unavailable, context, false, now + 61000);
  assert.equal(canReuseAccess(limited, context, now + 300000), true);
  const expired = reuseAccess(limited, context, false, now + 300000);
  assert.equal(expired.isGuildMember, false);
  assert.equal(expired.hasActiveCharacterLink, false);
  assert.equal(expired.authVerificationPending, true);
  assert.equal(expired.accessRetryAt, limited.accessRetryAt);
});
test('character DB failure cannot grant an active link or force an unverified new-link redirect', () => {
  const next = mergeVerifiedAccess({}, discord, unavailable, context, false, now);
  assert.equal(next.isGuildMember, true);
  assert.equal(next.hasActiveCharacterLink, false);
  assert.equal(next.authVerificationPending, true);
  assert.equal(mergeVerifiedAccess({}, discord, unavailable, context, true, now).authVerificationPending, false);
});
test('successful verification recovers all access without signing in again', () => {
  const pending = mergeVerifiedAccess({}, unavailable, unavailable, context, false, now);
  const recovered = mergeVerifiedAccess(pending, discord, character, context, false, now + 10000);
  assert.equal(recovered.isGuildMember, true);
  assert.equal(recovered.hasActiveCharacterLink, true);
  assert.equal(recovered.authDegraded, false);
  assert.equal(recovered.authVerificationPending, false);
  assert.equal(recovered.accessRetryAt, undefined);
});
const config = id => ({ guildId: id, zeusRoleId: 'zeus', adminRoleId: 'admin', botToken: 'fixture' });
test('Discord 429 respects Retry-After and coalesces calls during guild cooldown', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ retry_after: 30 }, { status: 429, headers: { 'Retry-After': '30' } }); };
  const first = await verifyDiscordAccess('member-a', config('rate-test'));
  const second = await verifyDiscordAccess('member-b', config('rate-test'));
  assert.equal(first.verified, false);
  assert.equal(second.retryAt, first.retryAt);
  assert.equal(calls, 1);
  assert.ok(first.retryAt >= Date.now() + 29000);
});
test('only Discord Unknown Member, not Unknown Guild or bot failures, confirms departure', async () => {
  globalThis.fetch = async () => Response.json({ code: 10007 }, { status: 404 });
  assert.equal((await verifyDiscordAccess('member', config('gone'))).value.isGuildMember, false);
  for (const [status, code] of [[404,10004],[401,0],[403,0],[503,0]]) {
    globalThis.fetch = async () => Response.json({ code }, { status });
    assert.equal((await verifyDiscordAccess('member', config(`unavailable-${status}`))).verified, false);
  }
});
test('a successful Discord role response can revoke the Zeus role; malformed data cannot', async () => {
  globalThis.fetch = async () => Response.json({ roles: [] });
  const removed = await verifyDiscordAccess('member', config('removed-role'));
  assert.equal(removed.value.isGuildMember, true);
  assert.equal(removed.value.hasZeusRole, false);
  globalThis.fetch = async () => Response.json({});
  assert.equal((await verifyDiscordAccess('member', config('malformed'))).verified, false);
});
