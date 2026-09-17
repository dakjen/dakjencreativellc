// Shared protection for the form endpoints: a per-IP rate limit and a
// minimum time-to-submit. Both fail closed in a way that's invisible to
// bots (a fake success) and honest to humans (a plain sentence).
//
// The rate limit is in-memory, so it's per warm function instance — not
// perfect across Vercel's fleet, but it stops the common case: one client
// hammering one endpoint. Good enough for four low-volume forms.

const WINDOW_MS = 10 * 60 * 1000;   // 10 minutes
const MAX_HITS = 6;                 // per IP, per endpoint, per window
const MIN_MS = 1500;                // a human can't fill a form in under 1.5s

const buckets = new Map();

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (Array.isArray(xf) ? xf[0] : (xf || '')).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

function rateLimited(req) {
  const key = `${req.url}|${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(key) || { start: now, n: 0 };
  if (now - b.start > WINDOW_MS) { b.start = now; b.n = 0; }
  b.n += 1;
  buckets.set(key, b);
  if (buckets.size > 5000) buckets.clear();   // never let it grow without bound
  return b.n > MAX_HITS;
}

// The page stamps `started` (ms since epoch) when the form is first shown.
// Missing or too-fast → treat as a bot: pretend it worked, send nothing.
function tooFast(body) {
  const t = Number(body && body.started);
  if (!t) return false;                       // older pages without the stamp: let it through
  return Date.now() - t < MIN_MS;
}

// Returns a response if the request should be stopped, otherwise null.
function guard(req, res, body) {
  if (rateLimited(req)) {
    return res.status(429).json({ error: 'That is a lot of submissions in a row. Give it a few minutes, or email business@dakjencreative.com.' });
  }
  if (body && body.website) return res.status(200).json({ ok: true });   // honeypot
  if (tooFast(body)) return res.status(200).json({ ok: true });
  return null;
}

module.exports = { guard };
