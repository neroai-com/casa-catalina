// Public: serve a property image (?id=...). Bytes come from the blob store.
const { load, getBlob } = require('../../../../../packages/core/store');
const { getSlug } = require('../../../../../packages/core/props');

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('method not allowed'); }
  const slug = getSlug(req);
  const id = (req.query && req.query.id) ||
    (new URL(req.url, 'http://x').searchParams.get('id') || '');
  if (!slug || !/^[a-f0-9]{16}$/.test(id)) { res.statusCode = 400; return res.end('bad request'); }
  try {
    const data = await load();
    const p = data.properties[slug];
    if (!p || !(p.images || []).some(x => x.id === id)) { res.statusCode = 404; return res.end('not found'); }
    const base64 = await getBlob(id);
    if (!base64) { res.statusCode = 404; return res.end('not found'); }
    const buf = Buffer.from(base64, 'base64');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buf);
  } catch (e) {
    console.error('image:', e.message);
    res.statusCode = 500; res.end('unavailable');
  }
};
