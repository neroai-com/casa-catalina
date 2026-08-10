// Public: the property's editable landing-page content (text fields only).
const { load } = require('../../../../../packages/core/store');
const { send } = require('../../../../../packages/core/util');
const { getSlug } = require('../../../../../packages/core/props');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  const slug = getSlug(req);
  if (!slug) return send(res, 400, { error: 'bad property' });
  try {
    const data = await load();
    const p = data.properties[slug];
    if (!p) return send(res, 404, { error: 'unknown property' });
    send(res, 200, { content: p.content || {} });
  } catch (e) {
    console.error('content:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
