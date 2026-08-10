// Public: submit a booking request for one property. Validated, honeypot-guarded,
// rate-limited. Called cross-site via each property site's server-side /api rewrite,
// so no Origin check here — spam defense is honeypot + per-IP + pending caps.
const { mutate } = require('../../../../../packages/core/store');
const { isDate, todayLA, nights, overlaps, clampInt, cleanText, id, ipHash, send } = require('../../../../../packages/core/util');
const { getSlug } = require('../../../../../packages/core/props');

const MAX_NIGHTS = 30;
const MAX_PENDING = 100;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  const slug = getSlug(req);
  if (!slug) return send(res, 400, { error: 'bad property' });

  const b = req.body || {};

  // Honeypot: bots fill it; pretend success and drop.
  if (b.website) return send(res, 200, { ok: true });

  const checkIn = b.checkIn, checkOut = b.checkOut;
  if (!isDate(checkIn) || !isDate(checkOut)) return send(res, 400, { error: 'Invalid dates.' });
  if (checkIn < todayLA()) return send(res, 400, { error: 'Check-in is in the past.' });
  const n = nights(checkIn, checkOut);
  if (n < 1) return send(res, 400, { error: 'Check-out must be after check-in.' });
  if (n > MAX_NIGHTS) return send(res, 400, { error: `Stays are limited to ${MAX_NIGHTS} nights.` });

  const adults = clampInt(b.adults, 1, 12);
  const children = clampInt(b.children, 0, 10);
  const infants = clampInt(b.infants, 0, 6);
  const pets = clampInt(b.pets, 0, 4);
  if (adults === null || children === null || infants === null || pets === null)
    return send(res, 400, { error: 'Invalid party size.' });

  const name = cleanText(b.name, 80);
  const contact = cleanText(b.contact, 120);
  const note = cleanText(b.note, 500);
  if (name.length < 2) return send(res, 400, { error: 'Please add your name.' });
  if (contact.length < 5) return send(res, 400, { error: 'Please add a phone number or email.' });

  try {
    let request = null;
    const out = await mutate(function (data) {
      const prop = data.properties[slug];
      if (!prop) return { save: false, status: 404, body: { error: 'unknown property' } };

      // Per-property sleeps cap (from CMS content; default 6).
      const cap = parseInt(prop.content && prop.content.sleeps, 10) || 6;
      if (adults + children > cap)
        return { save: false, status: 400, body: { error: `${prop.name || 'This home'} sleeps up to ${cap} guests.` } };

      // Reject stays that overlap this property's blocked nights.
      if (data.blocks.some(x => x.property === slug && overlaps(checkIn, checkOut, x.start, x.end)))
        return { save: false, status: 409, body: { error: 'Those dates were just booked — please pick different dates.' } };

      const now = Date.now();
      const iph = ipHash(req);
      data.meta.recent = (data.meta.recent || []).filter(r => now - r.t < 24 * 3600 * 1000);
      if (data.meta.recent.filter(r => r.ip === iph).length >= 8)
        return { save: false, status: 429, body: { error: 'Too many requests — please call or text us instead.' } };
      if (data.requests.filter(r => r.status === 'pending').length >= MAX_PENDING)
        return { save: false, status: 429, body: { error: 'Please call or text us to book.' } };
      data.meta.recent.push({ ip: iph, t: now });

      request = {
        id: id(), property: slug, status: 'pending', createdAt: new Date().toISOString(),
        checkIn, checkOut, nights: n, adults, children, infants, pets, name, contact, note,
      };
      data.requests.push(request);
      return { save: true, status: 200, body: { ok: true, id: request.id } };
    });

    send(res, out.status, out.body);
    if (out.status === 200 && request) notifyOwner(request).catch(() => {});
  } catch (e) {
    console.error('request:', e.message);
    send(res, 500, { error: 'Something went wrong — please call or text us.' });
  }
};

// Optional email ping to the owner (active only when RESEND_API_KEY + NOTIFY_EMAIL are set).
async function notifyOwner(r) {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'Catalina Rentals <onboarding@resend.dev>',
      to: [to],
      subject: `[${r.property}] Booking request: ${r.checkIn} - ${r.checkOut} (${r.name})`,
      text: `New booking request — ${r.property}\n\n` +
        `Dates: ${r.checkIn} to ${r.checkOut} (${r.nights} nights)\n` +
        `Party: ${r.adults} adults, ${r.children} children, ${r.infants} infants, ${r.pets} pets\n` +
        `Name: ${r.name}\nContact: ${r.contact}\nNote: ${r.note || '-'}\n\n` +
        `Approve or decline in the CMS.`,
    }),
  });
}
