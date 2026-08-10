const { mutate, load } = require('../_lib/store');
const { clearCookie, isAuthed } = require('../_lib/auth');
const { send } = require('../_lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  try {
    // If the caller holds a valid session, bump the session version so every
    // outstanding token (any device) is revoked — not just this cookie.
    const data = await load();
    if (isAuthed(req, data.meta.sessV)) {
      await mutate(function (d) {
        d.meta.sessV = (d.meta.sessV || 1) + 1;
        return { save: true, status: 200, body: { ok: true } };
      });
    }
  } catch (e) {
    console.error('logout:', e.message);
  }
  res.setHeader('Set-Cookie', clearCookie());
  send(res, 200, { ok: true });
};
