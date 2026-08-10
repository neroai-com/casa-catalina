// Public: blocked night ranges for one property — no names, no request details.
const { load } = require('../../../../../packages/core/store');
const { send } = require('../../../../../packages/core/util');
const { getSlug } = require('../../../../../packages/core/props');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  const slug = getSlug(req);
  if (!slug) return send(res, 400, { error: 'bad property' });
  try {
    const data = await load();
    if (!data.properties[slug]) return send(res, 404, { error: 'unknown property' });
    const blocked = data.blocks
      .filter(b => b.property === slug)
      .map(b => ({ start: b.start, end: b.end }))
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    send(res, 200, { blocked });
  } catch (e) {
    console.error('availability:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
