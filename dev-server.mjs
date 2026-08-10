// Local dev server: serves the static site AND the same /api handlers Vercel runs,
// backed by ./dev-data.json (gitignored). Usage:
//   ADMIN_PASSWORD=catalina node dev-server.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2], 10) || 8099;
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

// Route table mirroring Vercel's file-based /api routing.
const routes = {};
function scan(dir, prefix) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { if (!f.startsWith('_')) scan(full, `${prefix}/${f}`); continue; }
    if (f.endsWith('.js') && !f.startsWith('_')) routes[`${prefix}/${f.slice(0, -3)}`] = full;
  }
}
scan(path.join(ROOT, 'api'), '/api');
console.log('[dev] api routes:', Object.keys(routes).join(', '));

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (routes[p]) {
    // parity with Vercel: platform-set client IP headers
    req.headers['x-real-ip'] = req.socket.remoteAddress || '127.0.0.1';
    req.headers['x-forwarded-for'] = req.socket.remoteAddress || '127.0.0.1';
    let body = '';
    for await (const chunk of req) body += chunk;
    try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
    try {
      await require(routes[p])(req, shim(res));
    } catch (e) {
      console.error('[api]', p, e);
      shim(res).status(500).json({ error: 'internal' });
    }
    return;
  }

  // static
  let file = p === '/' ? '/index.html' : decodeURIComponent(p);
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(ROOT, file);
  if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.statusCode = 404; res.end('not found'); return;
  }
  res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}).listen(PORT, () => console.log(`[dev] http://localhost:${PORT}`));
