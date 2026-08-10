const { mutate, load } = require('../../../../packages/core/store');
const { clearCookie, isAuthed } = require('../../../../packages/core/auth');
const { send } = require('../../../../packages/core/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  try {
    // Bump the session version so every outstanding token (any device) is revoked.
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
