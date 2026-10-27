import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, after } from 'node:test';
import ts from 'typescript';

const previousGuild = process.env.DISCORD_GUILD_ID;
process.env.DISCORD_GUILD_ID = 'test-guild';
after(() => {
  if (previousGuild === undefined) delete process.env.DISCORD_GUILD_ID;
  else process.env.DISCORD_GUILD_ID = previousGuild;
});
let serial = 0;
const savedAt = '2026-10-26T02:30:00Z';
const freshAt = '2026-10-27T11:43:00Z';
const member = (gid, nickname, guild, growth = 70000) => ({
  gid, nickname, guild, job: '나이트', growthPower: growth.toLocaleString('en-US'),
  growthPowerNumber: growth, attendanceRate: '0%', participationCount: 0, targetCount: 0,
});
async function harness(members, mode = 'authoritative') {
  const id = `__rosterTest${serial++}`;
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: { payload: { mode, members }, fetched_at: savedAt }, error: null }; },
  };
  globalThis[id] = { from: () => query };
  let source = await readFile(new URL('../lib/guild-roster.ts', import.meta.url), 'utf8');
  source = source.replace('import { supabaseAdmin } from "@/lib/supabase/admin";', `const supabaseAdmin = globalThis.${id};`);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)).includeUnreturnedGuilds;
}

test('new Sheet growth refreshes a registered member without losing any of four guilds', async () => {
  const saved = [member('1', '민짜', '핑뚝', 147928), member('2', 'A', '아스가르드'),
    member('3', 'B', '천제'), member('4', 'C', '지옥소녀')];
  const include = await harness(saved);
  const live = { ...member('1', '민짜', 'old-guild', 153000), job: '버서커', attendanceRate: '99%' };
  const result = await include([live, member('99', 'departed', '핑뚝', 999999)], freshAt);
  assert.deepEqual(result.members, [{ ...saved[0], job: '버서커', growthPower: '153,000', growthPowerNumber: 153000 }, ...saved.slice(1)]);
  assert.equal(result.supplementalUpdatedAt, savedAt);
  assert.equal(saved[0].growthPowerNumber, 147928);
});

test('older, equal, invalid, or unversioned upstream cannot overwrite curated growth', async () => {
  const saved = [member('1', '민짜', '핑뚝', 147928)];
  const include = await harness(saved);
  for (const timestamp of [undefined, 'invalid', savedAt, '2026-10-25T00:00:00Z']) {
    assert.deepEqual((await include([member('1', '민짜', '핑뚝', 100000)], timestamp)).members, saved);
  }
});

test('renamed identities, duplicate upstream GIDs and invalid growth retain saved values', async () => {
  const saved = [member('1', '민짜', '핑뚝', 147928)];
  const include = await harness(saved);
  for (const upstream of [
    [member('1', 'different-character', '핑뚝', 153000)],
    [member('1', '민짜', '핑뚝', 153000), member('1', '민짜', '핑뚝', 160000)],
    ...[0, -1, NaN, Infinity].map(value => [{ ...saved[0], growthPowerNumber: value }]),
  ]) assert.deepEqual((await include(upstream, freshAt)).members, saved);
});

test('a valid newer lower measurement is respected, not treated as a maximum', async () => {
  const include = await harness([member('1', '민짜', '핑뚝', 153000)]);
  assert.equal((await include([member('1', '민짜', '핑뚝', 150000)], freshAt)).members[0].growthPowerNumber, 150000);
});

test('new job fills a missing class even without growth; blank job never erases a known class', async () => {
  const saved = [{ ...member('1', 'A', '핑뚝'), job: '' }, member('2', 'B', '핑뚝')];
  const include = await harness(saved);
  const result = await include([
    { ...saved[0], job: '앨리멘탈리스트', growthPowerNumber: 0 },
    { ...saved[1], job: '' },
  ], freshAt);
  assert.equal(result.members[0].job, '엘리멘탈리스트');
  assert.equal(result.members[0].growthPowerNumber, 70000);
  assert.equal(result.members[1].job, '나이트');
});

test('legacy supplement mode keeps its existing behavior', async () => {
  const saved = [member('2', 'A', '아스가르드')];
  const upstream = [member('1', '민짜', '핑뚝', 153000)];
  const include = await harness(saved, 'supplemental');
  assert.deepEqual((await include(upstream, freshAt)).members, [...upstream, ...saved]);
});
