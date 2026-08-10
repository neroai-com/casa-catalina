// Approve / decline a request. Approval creates the calendar block; declining an
// approved request removes its block.
const { load, mutate } = require('../_lib/store');
const { isAuthed, sameOrigin } = require('../_lib/auth');
const { overlaps, id, send } = require('../_lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });

  const { id: reqId, action } = req.body || {};
  if (!reqId || !['approve', 'decline'].includes(action)) return send(res, 400, { error: 'bad request' });

  try {
    const pre = await load();
    if (!isAuthed(req, pre.meta.sessV)) return send(res, 401, { error: 'unauthorized' });

    const out = await mutate(function (data) {
      const r = data.requests.find(x => x.id === reqId);
      if (!r) return { save: false, status: 404, body: { error: 'request not found' } };

      if (action === 'approve') {
        const clash = data.blocks.some(x => x.requestId !== r.id && overlaps(r.checkIn, r.checkOut, x.start, x.end));
        if (clash) return { save: false, status: 409, body: { error: 'Those dates overlap an existing block.' } };
        r.status = 'approved';
        if (!data.blocks.some(x => x.requestId === r.id)) {
          data.blocks.push({ id: id(), start: r.checkIn, end: r.checkOut, source: 'approval', requestId: r.id });
        }
      } else {
        r.status = 'declined';
        data.blocks = data.blocks.filter(x => x.requestId !== r.id);
      }
      return { save: true, status: 200, body: { ok: true, status: r.status } };
    });
    send(res, out.status, out.body);
  } catch (e) {
    console.error('decide:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
