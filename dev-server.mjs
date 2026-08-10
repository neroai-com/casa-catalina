// Local dev for the whole monorepo, mirroring production topology:
//   :8100  CMS        (apps/cms static + /api/admin/* + /api/public/[property]/*)
//   :8099  LP site    (apps/casa-catalina static + prod-parity /api rewrites into the CMS handlers)
// Data lives in ./dev-data.json (gitignored).
//   ADMIN_PASSWORD=yourpass node dev-server.mjs [lpPort] [cmsPort]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LP_PORT = parseInt(process.argv[2], 10) || 8099;
const CMS_PORT = parseInt(process.argv[3], 10) || 8100;
const require = createRequire(import.meta.url);

if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = 'catalina';
  console.log('[dev] ADMIN_PASSWORD not set — using dev default "catalina"');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const CMS_API = path.join(ROOT, 'apps/cms/api');
const handler = (rel) => require(path.join(CMS_API, rel));

function resolveCmsRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]
  if (parts[0] !== 'api') return null;
  if (parts[1] === 'admin' && parts.length === 3) {
    const file = path.join(CMS_API, 'admin', parts[2] + '.js');
    return fs.existsSync(file) ? { rel: `admin/${parts[2]}.js`, query: {} } : null;
  }
  if (parts[1] === 'public' && parts.length === 4) {
    const file = path.join(CMS_API, 'public/[property]', parts[3] + '.js');
    return fs.existsSync(file) ? { rel: `public/[property]/${parts[3]}.js`, query: { property: parts[2] } } : null;
  }
  return null;
}

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  return res;
}

async function runApi(req, res, rel, query) {
  req.headers['x-real-ip'] = req.socket.remoteAddress || '127.0.0.1';
  req.headers['x-forwarded-for'] = req.socket.remoteAddress || '127.0.0.1';
  req.query = query;
  let body = '';
  for await (const chunk of req) body += chunk;
  try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
  try { await handler(rel)(req, shim(res)); }
  catch (e) { console.error('[api]', rel, e); shim(res).status(500).json({ error: 'internal' }); }
}

function serveStatic(appDir, req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(ROOT, appDir, file);
  if (!full.startsWith(path.join(ROOT, appDir)) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.statusCode = 404; res.end('not found'); return;
  }
  res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}

// CMS server
http.createServer(async (req, res) => {
  const p = new URL(req.url, `http://${req.headers.host}`).pathname;
  const route = resolveCmsRoute(p);
  if (route) return runApi(req, res, route.rel, route.query);
  serveStatic('apps/cms', req, res, p);
}).listen(CMS_PORT, () => console.log(`[dev] CMS  http://localhost:${CMS_PORT}`));

// LP servers with prod-parity rewrites — one port per LP app, slug parsed from
// each app's vercel.json (8099 = casa-catalina, then 8101, 8102, ... alphabetical).
const LP_REWRITES = {
  '/api/availability': 'public/[property]/availability.js',
  '/api/request': 'public/[property]/request.js',
  '/api/content': 'public/[property]/content.js',
};
const lpApps = fs.readdirSync(path.join(ROOT, 'apps'))
  .filter(d => d !== 'cms' && fs.existsSync(path.join(ROOT, 'apps', d, 'vercel.json')))
  .sort();
let nextPort = LP_PORT + 2;
for (const app of lpApps) {
  const vj = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', app, 'vercel.json'), 'utf8'));
  const m = (vj.rewrites && vj.rewrites[0] && vj.rewrites[0].destination || '').match(/\/public\/([a-z0-9-]+)\//);
  if (!m) continue;
  const slug = process.env.LP_SLUG && app === 'casa-catalina' ? process.env.LP_SLUG : m[1];
  const port = app === 'casa-catalina' ? LP_PORT : nextPort++;
  http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const p = u.pathname;
    if (LP_REWRITES[p]) return runApi(req, res, LP_REWRITES[p], { property: slug });
    const img = p.match(/^\/api\/image\/([a-f0-9]{16})$/);
    if (img) return runApi(req, res, 'public/[property]/image.js', { property: slug, id: img[1] });
    serveStatic('apps/' + app, req, res, p);
  }).listen(port, () => console.log(`[dev] ${app} (${slug}) http://localhost:${port}`));
}
