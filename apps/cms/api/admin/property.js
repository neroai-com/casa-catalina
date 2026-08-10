// Property CRUD: POST creates or updates (slug, name, content fields); DELETE removes
// a property along with its requests and blocks.
const { load, mutate } = require('../../../../packages/core/store');
const { isAuthed, sameOrigin } = require('../../../../packages/core/auth');
const { cleanText, send } = require('../../../../packages/core/util');
const { slugOk, sanitizeContent } = require('../../../../packages/core/props');

module.exports = async (req, res) => {
  if (!['POST', 'DELETE'].includes(req.method)) return send(res, 405, { error: 'method not allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });

  const b = req.body || {};
  try {
    const pre = await load();
    if (!isAuthed(req, pre.meta.sessV)) return send(res, 401, { error: 'unauthorized' });

    if (!slugOk(b.slug)) return send(res, 400, { error: 'Slug must be lowercase letters, numbers, and dashes (e.g. casa-catalina).' });

    if (req.method === 'DELETE') {
      const out = await mutate(function (data) {
        if (!data.properties[b.slug]) return { save: false, status: 404, body: { error: 'unknown property' } };
        delete data.properties[b.slug];
        data.requests = data.requests.filter(r => r.property !== b.slug);
        data.blocks = data.blocks.filter(x => x.property !== b.slug);
        return { save: true, status: 200, body: { ok: true } };
      });
      return send(res, out.status, out.body);
    }

    const name = cleanText(b.name, 60);
    if (name.length < 2) return send(res, 400, { error: 'Please add a property name.' });
    const content = sanitizeContent(b.content, cleanText);

    const out = await mutate(function (data) {
      const existing = data.properties[b.slug];
      data.properties[b.slug] = {
        slug: b.slug,
        name,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content: { ...(existing ? existing.content : {}), ...content },
      };
      return { save: true, status: 200, body: { ok: true, property: data.properties[b.slug] } };
    });
    send(res, out.status, out.body);
  } catch (e) {
    console.error('property:', e.message);
    send(res, 500, { error: 'unavailable' });
  }
};
