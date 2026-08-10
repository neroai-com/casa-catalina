// Record a payment against a booking request (Whop, PayPal, Venmo, Zelle, cash, other),
// or clear one. Manual entry by design — external processors reconcile by reference.
const { load, mutate } = require('../../../../packages/core/store');
const { isAuthed, sameOrigin } = require('../../../../packages/core/auth');
const { cleanText, send } = require('../../../../packages/core/util');

const METHODS = ['whop', 'paypal', 'venmo', 'zelle', 'cash', 'card', 'other'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });

  const b = req.body || {};
  try {
    const pre = await load();
    if (!isAuthed(req, pre.meta.sessV)) return send(res, 401, { error: 'unauthorized' });

    const out = await mutate(function (data) {
      const r = data.requests.find(x => x.id === b.id);
      if (!r) return { save: false, status: 404, body: { error: 'request not found' } };

      if (b.action === 'clear') {
        delete r.payment;
        return { save: true, status: 200, body: { ok: true } };
      }

      const amount = Math.round(parseFloat(b.amount) * 100) / 100;
      if (!(amount > 0 && amount < 100000)) return { save: false, status: 400, body: { error: 'Enter a valid amount.' } };
      const method = METHODS.includes(b.method) ? b.method : 'other';
      r.payment = {
        status: 'paid', amount, method,
        ref: cleanText(b.ref, 80),
        recordedAt: new Date().toISOString(),
      };
      return { save: true, status: 200, body: { ok: true, payment: r.payment } };
    });
    send(res, out.status, out.body);
  } catch (e) {
    console.error('billing:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
