// Owner's manual calendar blocks: POST adds one, DELETE removes one (any source).
const { load, mutate } = require('../_lib/store');
const { isAuthed, sameOrigin } = require('../_lib/auth');
const { isDate, nights, overlaps, cleanText, id, send } = require('../_lib/util');

module.exports = async (req, res) => {
  if (!['POST', 'DELETE'].includes(req.method)) return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });

  const b = req.body || {};
  try {
    const pre = await load();
    if (!isAuthed(req, pre.meta.sessV)) return send(res, 401, { error: 'unauthorized' });

    if (req.method === 'DELETE') {
      const out = await mutate(function (data) {
        const removed = data.blocks.find(x => x.id === b.id);
        if (!removed) return { save: false, status: 404, body: { error: 'block not found' } };
        data.blocks = data.blocks.filter(x => x.id !== b.id);
        // Unblocking an approval reverts that request to pending so it stays visible.
        if (removed.requestId) {
          const r = data.requests.find(x => x.id === removed.requestId);
          if (r && r.status === 'approved') r.status = 'pending';
        }
        return { save: true, status: 200, body: { ok: true } };
      });
      return send(res, out.status, out.body);
    }

    const { start, end } = b;
    if (!isDate(start) || !isDate(end) || nights(start, end) < 1) return send(res, 400, { error: 'Invalid dates.' });
    const note = cleanText(b.note, 120);
    const out = await mutate(function (data) {
      if (data.blocks.some(x => overlaps(start, end, x.start, x.end)))
        return { save: false, status: 409, body: { error: 'Overlaps an existing block.' } };
      const block = { id: id(), start, end, source: 'owner', note };
      data.blocks.push(block);
      return { save: true, status: 200, body: { ok: true, id: block.id } };
    });
    send(res, out.status, out.body);
  } catch (e) {
    console.error('blocks:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
