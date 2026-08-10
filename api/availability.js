// Public: blocked night ranges only — no names, no request details.
const { load } = require('./_lib/store');
const { send } = require('./_lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  try {
    const data = await load();
    const blocked = data.blocks
      .map(b => ({ start: b.start, end: b.end }))
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    send(res, 200, { blocked });
  } catch (e) {
    send(res, 500, { error: 'unavailable' });
  }
};
