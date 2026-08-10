// Property image manager: POST uploads (client-side downscaled JPEG data URL),
// DELETE removes. Image bytes live in blob keys; the property doc keeps metadata.
const { load, mutate, setBlob, delBlob } = require('../../../../packages/core/store');
const { isAuthed, sameOrigin } = require('../../../../packages/core/auth');
const { cleanText, id, send } = require('../../../../packages/core/util');
const { slugOk, catOk } = require('../../../../packages/core/props');

const MAX_IMAGES = 24;
const MAX_DATAURL = 1_400_000; // ~1MB of JPEG after base64

module.exports = async (req, res) => {
  if (!['POST', 'DELETE', 'PATCH'].includes(req.method)) return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });

  const b = req.body || {};
  try {
    const pre = await load();
    if (!isAuthed(req, pre.meta.sessV)) return send(res, 401, { error: 'unauthorized' });
    if (!slugOk(b.slug)) return send(res, 400, { error: 'bad property' });

    if (req.method === 'DELETE') {
      const out = await mutate(function (data) {
        const p = data.properties[b.slug];
        if (!p) return { save: false, status: 404, body: { error: 'unknown property' } };
        const imgs = p.images || [];
        const found = imgs.find(x => x.id === b.id);
        if (!found) return { save: false, status: 404, body: { error: 'image not found' } };
        p.images = imgs.filter(x => x.id !== b.id);
        return { save: true, status: 200, body: { ok: true } };
      });
      if (out.status === 200) delBlob(b.id).catch(() => {});
      return send(res, out.status, out.body);
    }

    if (req.method === 'PATCH') {
      // Recategorize / recaption an existing image.
      if (b.category == null && b.caption == null) return send(res, 400, { error: 'nothing to update' });
      if (b.category != null && !catOk(b.category)) return send(res, 400, { error: 'bad category' });
      if (b.caption != null && typeof b.caption !== 'string') return send(res, 400, { error: 'bad caption' });
      const out = await mutate(function (data) {
        const p = data.properties[b.slug];
        if (!p) return { save: false, status: 404, body: { error: 'unknown property' } };
        const img = (p.images || []).find(x => x.id === b.id);
        if (!img) return { save: false, status: 404, body: { error: 'image not found' } };
        if (b.category != null) img.category = b.category;
        if (b.caption != null) img.caption = cleanText(b.caption, 120);
        return { save: true, status: 200, body: { ok: true, image: img } };
      });
      return send(res, out.status, out.body);
    }

    // POST: upload
    const dataUrl = b.dataUrl;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,'))
      return send(res, 400, { error: 'Images must be JPEG (the uploader converts automatically).' });
    if (dataUrl.length > MAX_DATAURL)
      return send(res, 400, { error: 'Image too large — try again (it should compress automatically).' });
    const base64 = dataUrl.slice('data:image/jpeg;base64,'.length);
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return send(res, 400, { error: 'Invalid image data.' });

    const imgId = id();
    const caption = cleanText(b.caption, 120);
    const category = catOk(b.category) ? b.category : 'additional photos';
    await setBlob(imgId, base64);
    const out = await mutate(function (data) {
      const p = data.properties[b.slug];
      if (!p) return { save: false, status: 404, body: { error: 'unknown property' } };
      p.images = p.images || [];
      if (p.images.length >= MAX_IMAGES)
        return { save: false, status: 400, body: { error: `Limit of ${MAX_IMAGES} images per property.` } };
      p.images.push({ id: imgId, caption, category, addedAt: new Date().toISOString() });
      return { save: true, status: 200, body: { ok: true, id: imgId } };
    });
    if (out.status !== 200) delBlob(imgId).catch(() => {});
    send(res, out.status, out.body);
  } catch (e) {
    console.error('images:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
