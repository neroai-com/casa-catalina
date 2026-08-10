// Property helpers: slug extraction/validation and the editable LP content schema.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;

function slugOk(s) { return typeof s === 'string' && SLUG_RE.test(s); }

// Dynamic [property] segment: Vercel puts it in req.query; fall back to URL parsing
// (dev server / defensive).
function getSlug(req) {
  const q = req.query && req.query.property;
  if (slugOk(q)) return q;
  const m = (req.url || '').match(/\/api\/public\/([a-z0-9-]+)\//);
  return m && slugOk(m[1]) ? m[1] : null;
}

// Editable landing-page fields (everything the LP hydrates). Text-only values.
const CONTENT_FIELDS = {
  name:         { max: 60,  label: 'Property name' },
  locationLine: { max: 80,  label: 'Location line (hero eyebrow)' },
  heroTitle:    { max: 60,  label: 'Hero title' },
  heroLead:     { max: 300, label: 'Hero intro paragraph' },
  phone:        { max: 24,  label: 'Phone (digits, for tel/sms links)' },
  email:        { max: 80,  label: 'Email' },
  sleeps:       { max: 2,   label: 'Sleeps (number)' },
  bedrooms:     { max: 2,   label: 'Bedrooms (number)' },
  baths:        { max: 3,   label: 'Baths (number)' },
  ratesNote:    { max: 60,  label: 'Rates note (sticky bar)' },
  bookLead:     { max: 300, label: 'Booking section intro' },
  payNote:      { max: 160, label: 'Payment note' },
};

function sanitizeContent(input, cleanText) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of Object.keys(CONTENT_FIELDS)) {
    if (input[k] != null) out[k] = cleanText(String(input[k]), CONTENT_FIELDS[k].max);
  }
  return out;
}

module.exports = { slugOk, getSlug, CONTENT_FIELDS, sanitizeContent };
