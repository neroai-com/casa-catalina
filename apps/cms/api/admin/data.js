// Admin: everything the dashboard needs — properties, requests, blocks.
const { load } = require('../../../../packages/core/store');
const { isAuthed } = require('../../../../packages/core/auth');
const { send } = require('../../../../packages/core/util');
const { CONTENT_FIELDS } = require('../../../../packages/core/props');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  try {
    const data = await load();
    if (!isAuthed(req, data.meta.sessV)) return send(res, 401, { error: 'unauthorized' });
    send(res, 200, {
      properties: data.properties,
      requests: data.requests.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      blocks: data.blocks.slice().sort((a, b) => (a.start < b.start ? -1 : 1)),
      contentFields: CONTENT_FIELDS,
    });
  } catch (e) {
    console.error('data:', e.message);
    send(res, 500, { error: e.code === 'storage-unconfigured'
      ? "Storage isn't connected yet — in Vercel: Storage → Create Database → Redis (Upstash) → connect it to the catalina-rentals-cms project, then Redeploy."
      : 'unavailable' });
  }
};
