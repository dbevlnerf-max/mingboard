import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/guild-roster-merge.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { mergeLiveRoster } = await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));

function member(gid, job = "", growth = 0, extra = {}) {
  return {
    gid: String(gid), nickname: "승인된이름", guild: "핑뚝", job,
    growthPower: growth.toLocaleString("en-US"), growthPowerNumber: growth,
    ...extra,
  };
}

test("enriches only matching GIDs without changing guild or nickname", () => {
  const saved = [member(1, "", 70000), member(2, "레인저", 85000, { guild: "천제" })];
  const live = [member(1, "버서커", 90100, { nickname: "옛날이름", guild: "빨뚝" }),
    member(3, "오라클", 95000)];
  const result = mergeLiveRoster(saved, live);
  assert.equal(result.members.length, 2);
  assert.equal(result.members[0].growthPowerNumber, 90100);
  assert.equal(result.members[0].growthPower, "90,100");
  assert.equal(result.members[0].job, "버서커");
  assert.equal(result.members[0].nickname, "승인된이름");
  assert.equal(result.members[0].guild, "핑뚝");
  assert.equal(result.members[1].guild, "천제");
  assert.equal(result.liveMatchedCount, 1);
  assert.equal(result.liveUpdatedCount, 1);
});

test("blank or invalid live fields never destroy saved growth or job", () => {
  const saved = [member(1, "레인저", 99999)];
  const live = [{ gid: "1", job: "", growthPower: "invalid", growthPowerNumber: 0 }];
  const result = mergeLiveRoster(saved, live);
  assert.deepEqual(result.members, saved);
  assert.equal(result.liveUpdatedCount, 0);
});

test("duplicate IDs in the live feed are rejected instead of choosing an arbitrary row", () => {
  const saved = [member(1, "레인저", 99999)];
  const result = mergeLiveRoster(saved, [member(1, "버서커", 100000), member(1, "오라클", 110000)]);
  assert.deepEqual(result.members, saved);
  assert.equal(result.liveMatchedCount, 0);
});

test("valid formatted growth is accepted, and legacy job spelling is normalized", () => {
  const result = mergeLiveRoster([member(1)], [
    { gid: "1", job: "앨리멘탈리스트", growthPower: "105,123", growthPowerNumber: 0 },
  ]);
  assert.equal(result.members[0].job, "엘리멘탈리스트");
  assert.equal(result.members[0].growthPowerNumber, 105123);
});
