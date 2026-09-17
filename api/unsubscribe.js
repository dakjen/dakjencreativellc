// One-click unsubscribe. Each outbound email to a person carries a link to
// /api/unsubscribe?e=<email>&t=<signature>. The signature is an HMAC of the
// email keyed on the Brevo API key, so nobody can unsubscribe someone else by
// guessing an address. Marks the contact blocklisted in Brevo — no more email
// from any DakJen Creative list or form — and shows a small confirmation page.
//
// GET  → human clicked the link in the email
// POST → Gmail/Apple "Unsubscribe" button (RFC 8058 List-Unsubscribe-Post)

const crypto = require('crypto');

function sign(email) {
  return crypto.createHmac('sha256', process.env.BREVO_API_KEY || 'unset')
    .update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
}

function unsubscribeUrl(email) {
  return `https://www.dakjencreative.com/api/unsubscribe?e=${encodeURIComponent(email)}&t=${sign(email)}`;
}

async function blocklist(email) {
  const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ emailBlacklisted: true }),
  });
  if (res.ok) return true;
  if (res.status === 404) return true;          // never stored — nothing to unsubscribe from, treat as done
  console.error(`Brevo unsubscribe ${res.status}: ${await res.text()}`);
  return false;
}

function page(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title} | DakJen Creative</title>
<link rel="icon" href="/favicon.ico"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700&family=Fraunces:opsz,wght@9..144,400&display=swap" rel="stylesheet">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c1c2c;color:#f5f2ee;font-family:'Fraunces',Georgia,serif}
.box{max-width:520px;padding:2.5rem 1.5rem;text-align:center}.ey{font-family:'Syne',system-ui,sans-serif;font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:#c07481;margin-bottom:1rem}
h1{font-family:'Syne',system-ui,sans-serif;font-size:2rem;font-weight:400;margin:0 0 1rem}p{line-height:1.8;color:rgba(255,255,255,.65);margin:0 0 1.5rem}
a{color:#c07481;text-decoration:none}.logo{font-family:'Syne',system-ui,sans-serif;font-weight:700;color:#f5f2ee;letter-spacing:.05em;display:block;margin-bottom:2rem}.logo span{color:#c07481}</style></head>
<body><div class="box"><a class="logo" href="https://www.dakjencreative.com">DakJen <span>Creative</span></a>${body}</div></body></html>`;
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const email = String(q.e || '').trim();
  const token = String(q.t || '').trim();
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');

  if (!email || !token || token !== sign(email)) {
    return res.status(400).send(page('Link not valid',
      `<div class="ey">Unsubscribe</div><h1>That link isn't valid.</h1><p>It may have been cut off by your email client. Reply to any email from us with "remove" and we'll take care of it by hand.</p>`));
  }
  if (!process.env.BREVO_API_KEY) return res.status(503).send(page('Try again later', `<div class="ey">Unsubscribe</div><h1>Not right now.</h1><p>Email <a href="mailto:business@dakjencreative.com">business@dakjencreative.com</a> with "remove" and we'll do it by hand.</p>`));

  const ok = await blocklist(email);
  if (req.method === 'POST') return res.status(ok ? 200 : 502).end();   // one-click: no body needed
  if (!ok) return res.status(502).send(page('Something went wrong', `<div class="ey">Unsubscribe</div><h1>That didn't go through.</h1><p>Email <a href="mailto:business@dakjencreative.com">business@dakjencreative.com</a> with "remove" and we'll do it by hand.</p>`));
  return res.status(200).send(page('You are unsubscribed',
    `<div class="ey">Unsubscribe</div><h1>You're off the list.</h1><p><strong style="color:#f5f2ee">${email.replace(/</g,'&lt;')}</strong> won't get any more email from DakJen Creative. If that was a mistake, just fill out a form on the site again.</p><p><a href="https://www.dakjencreative.com">← Back to the site</a></p>`));
};

module.exports.unsubscribeUrl = unsubscribeUrl;
