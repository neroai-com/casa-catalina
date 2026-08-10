// Storage adapter: Upstash Redis (Vercel Marketplace) in production, JSON file locally.
// One property, low volume — the whole dataset lives in a single versioned JSON document.
// All writes go through mutate(), which retries on version conflict (optimistic CAS),
// so concurrent guest submissions and owner approvals can't overwrite each other.
const KEY = 'casa-catalina:data';

const EMPTY = { _v: 0, requests: [], blocks: [], meta: { recent: [], loginFail: [], sessV: 1 } };

function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

// Fail loudly on Vercel with no storage attached — a silent empty-file fallback would
// show every booked date as open and 500 on writes with no useful log line.
function assertConfigured() {
  if (process.env.VERCEL && !redisEnv()) {
    throw new Error('Storage not configured: attach Upstash Redis so KV_REST_API_URL / KV_REST_API_TOKEN are set.');
  }
}

async function redisCmd(cmd) {
  const { url, token } = redisEnv();
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`storage backend error ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`storage backend: ${j.error}`);
  return j.result;
}

function filePath() {
  return process.env.DATA_FILE || require('path').join(process.cwd(), 'dev-data.json');
}

function normalize(parsed) {
  const d = { ...structuredClone(EMPTY), ...parsed };
  d.meta = { ...structuredClone(EMPTY.meta), ...(parsed.meta || {}) };
  return d;
}

async function load() {
  assertConfigured();
  if (redisEnv()) {
    const raw = await redisCmd(['GET', KEY]);
    if (!raw) return structuredClone(EMPTY);
    try { return normalize(JSON.parse(raw)); } catch { return structuredClone(EMPTY); }
  }
  const fs = require('fs');
  try { return normalize(JSON.parse(fs.readFileSync(filePath(), 'utf8'))); }
  catch { return structuredClone(EMPTY); }
}

// Compare-and-set: write only if the stored version still matches what we loaded.
const CAS_LUA =
  "local cur=redis.call('GET',KEYS[1]) local curv=0 " +
  "if cur then local ok,d=pcall(cjson.decode,cur) if ok and d._v then curv=d._v end end " +
  "if curv~=tonumber(ARGV[2]) then return 0 end " +
  "redis.call('SET',KEYS[1],ARGV[1]) return 1";

async function casSave(data, expectedV) {
  assertConfigured();
  data._v = expectedV + 1;
  const raw = JSON.stringify(data);
  if (redisEnv()) {
    const r = await redisCmd(['EVAL', CAS_LUA, '1', KEY, raw, String(expectedV)]);
    return r === 1;
  }
  const fs = require('fs');
  let curv = 0;
  try { curv = JSON.parse(fs.readFileSync(filePath(), 'utf8'))._v || 0; } catch {}
  if (curv !== expectedV) return false;
  fs.writeFileSync(filePath(), raw);
  return true;
}

// mutate(fn): fn(data) inspects/mutates the doc and returns
//   { save: true|false, status, body, ...extras }
// save:false responds without writing; save:true commits via CAS and retries fn on conflict.
async function mutate(fn) {
  for (let i = 0; i < 6; i++) {
    const data = await load();
    const v = data._v || 0;
    const out = await fn(data);
    if (!out || out.save === false) return out;
    if (await casSave(data, v)) return out;
    await new Promise(r => setTimeout(r, 25 + Math.floor(Math.random() * 50)));
  }
  return { save: false, status: 503, body: { error: 'Busy — please try again.' } };
}

module.exports = { load, mutate };
