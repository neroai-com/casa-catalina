const { load } = require('../_lib/store');
const { isAuthed } = require('../_lib/auth');
const { send } = require('../_lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  try {
    const data = await load();
    if (!isAuthed(req, data.meta.sessV)) return send(res, 401, { error: 'unauthorized' });
    send(res, 200, {
      requests: data.requests.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      blocks: data.blocks.slice().sort((a, b) => (a.start < b.start ? -1 : 1)),
    });
  } catch (e) {
    console.error('data:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
