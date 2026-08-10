const { mutate } = require('../../../../packages/core/store');
const { passwordOk, issueCookie, sameOrigin } = require('../../../../packages/core/auth');
const { ipHash, send } = require('../../../../packages/core/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  if (!process.env.ADMIN_PASSWORD) return send(res, 500, { error: 'Admin login is not configured (set ADMIN_PASSWORD).' });

  const pw = (req.body || {}).password;
  try {
    // Durable brute-force damper: failures live in the shared store, so the cap
    // holds across serverless instances and cold starts.
    const out = await mutate(function (data) {
      const now = Date.now(), iph = ipHash(req);
      data.meta.loginFail = (data.meta.loginFail || []).filter(f => now - f.t < 15 * 60 * 1000);
      const mine = data.meta.loginFail.filter(f => f.ip === iph).length;
      if (mine >= 10 || data.meta.loginFail.length >= 30)
        return { save: false, status: 429, body: { error: 'Too many attempts — try again in 15 minutes.' } };
      if (!passwordOk(pw)) {
        data.meta.loginFail.push({ ip: iph, t: now });
        return { save: true, status: 401, body: { error: 'Wrong password.' } };
      }
      data.meta.loginFail = data.meta.loginFail.filter(f => f.ip !== iph);
      return { save: true, status: 200, body: { ok: true }, sessV: data.meta.sessV || 1 };
    });

    if (out.status === 200) res.setHeader('Set-Cookie', issueCookie(req, out.sessV));
    send(res, out.status, out.body);
  } catch (e) {
    console.error('login:', e.message);
    send(res, 500, { error: e.code === 'storage-unconfigured'
      ? "Storage isn't connected yet — in Vercel: Storage → Create Database → Redis (Upstash) → connect it to the catalina-rentals-cms project, then Redeploy."
      : 'unavailable' });
  }
};
