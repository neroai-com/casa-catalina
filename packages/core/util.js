const crypto = require('crypto');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Today as YYYY-MM-DD in the property's timezone (America/Los_Angeles).
function todayLA() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

function nights(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

// Nights-based overlap: ranges are [checkIn, checkOut) — checkout day can be another check-in.
function overlaps(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return null;
  return n >= min && n <= max ? n : null;
}

function cleanText(v, maxLen) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

function ipHash(req) {
  // Trust platform-set headers only: x-real-ip on Vercel, else the RIGHTMOST
  // x-forwarded-for entry (appended by the closest proxy — leftmost is client-spoofable).
  const xff = (req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  const ip = req.headers['x-real-ip'] || xff[xff.length - 1] ||
    (req.socket && req.socket.remoteAddress) || 'local';
  return crypto.createHash('sha256').update('casa:' + ip).digest('hex').slice(0, 16);
}

function send(res, code, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(obj);
}

module.exports = { isDate, todayLA, nights, overlaps, clampInt, cleanText, id, ipHash, send };
