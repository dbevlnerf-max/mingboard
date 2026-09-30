import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test, after } from 'node:test';
import ts from 'typescript';
const uri = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`;
const portalUri = uri(await readFile(new URL('../lib/portal-request.ts', import.meta.url), 'utf8'));
const originalFetch = globalThis.fetch;
const oldGuild = process.env.DISCORD_GUILD_ID;
process.env.DISCORD_GUILD_ID = 'test-guild';
after(() => { globalThis.fetch = originalFetch; if (oldGuild === undefined) delete process.env.DISCORD_GUILD_ID; else process.env.DISCORD_GUILD_ID = oldGuild; });
let serial = 0;
async function harness() {
  const h = { rows: new Map(), after: [], dbCalls: 0, saves: 0, error: null };
  h.db = {
    from() {
      const filters = {}; let patch;
      const query = {
        select() { return query; }, eq(key,value) { filters[key]=value; return query; },
        update(value) { patch=value; return query; },
        abortSignal() { return query; },
        async maybeSingle() { h.dbCalls++; return { data: h.rows.get(filters.query_key) ?? null, error: h.error }; },
        then(resolve,reject) { return Promise.resolve().then(() => { for (const row of h.rows.values()) Object.assign(row,patch); return { error: h.error }; }).then(resolve,reject); },
      };
      return query;
    },
    rpc(_name,args) { return { async abortSignal() { h.saves++; const previous=h.rows.get(args.p_query_key); if (!previous || args.p_fetched_at >= previous.fetched_at && (!previous.invalidated_at || args.p_fetched_at >= previous.invalidated_at)) h.rows.set(args.p_query_key, { payload: args.p_payload, fetched_at: args.p_fetched_at, invalidated_at: null }); return { error: h.error }; } }; },
  };
  const id = `__sheetTest${serial++}`;
  globalThis[id]=h;
  let source=await readFile(new URL('../lib/sheet-read.ts', import.meta.url),'utf8');
  source=source.replace('import { NextResponse } from "next/server";', 'const NextResponse = { json: (data,options) => Response.json(data,options) };')
    .replace('import { after } from "next/server";', `const after = task => globalThis.${id}.after.push(task);`)
    .replace('import { unstable_cache, revalidateTag } from "next/cache";', `const unstable_cache = fn => { const cache = new Map(); return async (...args) => { const key=JSON.stringify(args); if (!cache.has(key)) cache.set(key, await fn(...args)); return cache.get(key); }; }; const revalidateTag=()=>{};`)
    .replace('import { supabaseAdmin } from "./supabase/admin";', `const supabaseAdmin = globalThis.${id}.db;`)
    .replace('"./portal-request"',JSON.stringify(portalUri));
  h.module=await import(uri(source));
  h.key=params=>{ const q=new URLSearchParams(params);q.sort(); return createHash('sha256').update(q.toString()).digest('hex'); };
  h.seed=(params,payload,age=0,invalidated=false)=>h.rows.set(h.key(params), { payload, fetched_at:new Date(Date.now()-age).toISOString(), invalidated_at:invalidated?new Date().toISOString():null });
  h.read=(params,field='members',fresh=false)=>h.module.readSheet('https://sheets.invalid/exec',new URLSearchParams(params),new AbortController().signal,field,fresh);
  h.drain=async()=>{ while(h.after.length) await Promise.all(h.after.splice(0).map(task=>task())); };
  return h;
}
const guild = { action: 'guild' };
test('fresh saved snapshots bypass slow Sheets even in a new request', async()=>{
  const h=await harness(); h.seed(guild,{success:true,members:[{nickname:'밍쨩'}]});
  globalThis.fetch=async()=>{throw Error('Sheets must not be requested');};
  const result=await h.read(guild);
  assert.equal(result.members[0].nickname,'밍쨩'); assert.equal(result.stale,false); assert.equal(h.after.length,0);
});
test('stale snapshots return before refresh, then publish new data in the background', async()=>{
  const h=await harness(); h.seed(guild,{success:true,members:[{nickname:'이전'}]},60000);
  let calls=0; globalThis.fetch=async()=>{calls++; return Response.json({success:true,members:[{nickname:'최신'}]});};
  const result=await h.read(guild); assert.equal(result.members[0].nickname,'이전'); assert.equal(result.stale,true); assert.equal(calls,0);
  await h.drain(); assert.equal(calls,1); assert.equal((await h.read(guild)).members[0].nickname,'최신');
});
test('upstream failures cannot overwrite a last good snapshot', async()=>{
  const h=await harness(); h.seed(guild,{success:true,members:[{nickname:'유지'}]},60000);
  globalThis.fetch=async()=>Response.json({success:false,message:'unavailable'}, {status:503});
  await h.read(guild); await h.drain();
  assert.equal(h.rows.get(h.key(guild)).payload.members[0].nickname,'유지'); assert.equal(h.saves,0);
});
test('manual refresh bypasses the saved snapshot and only caches successful complete responses', async()=>{
  const h=await harness(); h.seed(guild,{success:true,members:[{nickname:'이전'}]});
  globalThis.fetch=async()=>Response.json({success:true,members:[{nickname:'새로'}]});
  assert.equal((await h.read(guild,'members',true)).members[0].nickname,'새로');
  globalThis.fetch=async()=>Response.json({success:true});
  await assert.rejects(h.read(guild,'members',true));
  assert.equal(h.rows.get(h.key(guild)).payload.members[0].nickname,'새로');
});
test('different distribution filters and nicknames cannot share snapshots', async()=>{
  const h=await harness();
  const weapon={action:'distributionList',category:'무기'}; const armor={action:'distributionList',category:'방어구'};
  h.seed(weapon,{success:true,rows:['무기']});h.seed(armor,{success:true,rows:['방어구']});
  assert.deepEqual((await h.read(weapon,'rows')).rows,['무기']); assert.deepEqual((await h.read(armor,'rows')).rows,['방어구']);
  globalThis.fetch=async()=>Response.json({success:false,multiple:true,candidates:['밍쨩','민짜']});
  const result=await h.read({action:'search',nickname:'밍'},'items'); assert.equal(result.multiple,true); assert.equal(h.saves,0);
});
test('missing DB migration falls back to shared cache without repeatedly querying a missing table', async()=>{
  const h=await harness();h.error={code:'PGRST205'};let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({success:true,members:[]});};
  await h.read(guild);await h.read(guild); assert.equal(h.dbCalls,1);assert.equal(calls,1);
});
test('simultaneous cache misses coalesce the upstream request', async()=>{
  const h=await harness();let calls=0;
  globalThis.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,20));return Response.json({success:true,members:[]});};
  await Promise.all([h.read(guild),h.read(guild)]); assert.equal(calls,1);
});
test('writes invalidate snapshots so the next reader sees saved rows and triggers a refresh', async()=>{
  const h=await harness();h.seed(guild,{success:true,members:[]}); h.module.invalidatePortalSheetReads();await h.drain();
  const result=await h.read(guild);assert.equal(result.stale,true);assert.equal(h.after.length,1);
});
test('server responses remain private and do not expose shared data through public HTTP caches', async()=>{
  const h=await harness();const response=h.module.sheetJson({success:true});
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');assert.equal(response.headers.get('Vary'),'Cookie');
});
