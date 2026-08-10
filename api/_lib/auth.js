// Single-owner admin auth: password from env, HMAC-signed expiring token in an httpOnly cookie.
// Tokens carry the store's session version (meta.sessV); signing out bumps it, revoking
// every outstanding token immediately.
const crypto = require('crypto');

const COOKIE = 'casa_admin';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h session

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) return null;
  return crypto.createHash('sha256').update('casa-catalina:' + s).digest();
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(String(payload)).digest('base64url');
}

function timingSafeEq(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function passwordOk(pw) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof pw !== 'string') return false;
  return timingSafeEq(pw, expected);
}

function issueCookie(req, sessV) {
  const exp = Date.now() + TTL_MS;
  const val = `${exp}.${sessV}.${sign(exp + '.' + sessV)}`;
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `${COOKIE}=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_MS / 1000}${secure}`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// sessV comes from the loaded store doc (data.meta.sessV) — callers load first.
function isAuthed(req, sessV) {
  if (!secret()) return false;
  const raw = req.headers.cookie || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return false;
  const parts = m[1].split('.');
  if (parts.length !== 3) return false;
  const exp = parseInt(parts[0], 10), tokV = parseInt(parts[1], 10);
  if (!exp || Date.now() > exp) return false;
  if (tokV !== (sessV || 1)) return false;
  try { return timingSafeEq(parts[2], sign(exp + '.' + tokV)); } catch { return false; }
}

// Same-origin guard for state-changing endpoints (cookie-based CSRF hardening).
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser or same-origin GET-triggered
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  try { return new URL(origin).host === host; } catch { return false; }
}

module.exports = { passwordOk, issueCookie, clearCookie, isAuthed, sameOrigin };
