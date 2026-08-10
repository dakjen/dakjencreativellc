// Quote request intake — emails the full form through Brevo.
// Requires BREVO_API_KEY in the Vercel project environment.
// Optional: BREVO_SENDER (a verified Brevo sender), SCAN_RECIPIENT.

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const RECIPIENT = process.env.SCAN_RECIPIENT || 'business@dakjencreative.com';

const REQUIRED = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['organization', 'Organization'],
  ['service', 'What you need'],
  ['challenge', 'What you are trying to solve'],
];

const OPTIONAL = [
  ['phone', 'Phone'],
  ['timeline', 'Timeline'],
  ['budget', 'Budget range'],
  ['heard', 'How they found us'],
  ['notes', 'Anything else'],
];

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

async function sendEmail(payload) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  return res.json().catch(() => ({}));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.BREVO_API_KEY) {
    console.error('BREVO_API_KEY is not set');
    return res.status(503).json({ error: 'Form is not configured yet.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Malformed request.' });
    }
  }
  body = body || {};

  if (body.website) return res.status(200).json({ ok: true });

  const missing = REQUIRED.filter(([k]) => !String(body[k] || '').trim()).map(([, l]) => l);
  if (missing.length) {
    return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  }

  const email = String(body.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address looks incomplete.' });
  }

  const rows = [...REQUIRED, ...OPTIONAL]
    .filter(([k]) => String(body[k] || '').trim())
    .map(
      ([k, label]) =>
        `<tr><td style="padding:7px 16px 7px 0;color:#777;white-space:nowrap;vertical-align:top">${label}</td>` +
        `<td style="padding:7px 0;color:#111">${esc(body[k])}</td></tr>`
    )
    .join('');

  const org = String(body.organization).trim();
  const service = String(body.service).trim();

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative — Site', email: SENDER },
      to: [{ email: RECIPIENT }],
      replyTo: { email, name: String(body.name).trim() },
      subject: `Quote request — ${org} — ${service}`,
      htmlContent:
        `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6">` +
        `<p style="margin:0 0 18px"><strong>Quote request</strong></p>` +
        `<table style="border-collapse:collapse;font-size:14px">${rows}</table>` +
        `<p style="margin:22px 0 0;color:#777;font-size:13px">Reply directly to this email to reach ${esc(
          body.name
        )}.</p></div>`,
    });
  } catch (err) {
    console.error('Quote notification failed:', err.message);
    return res.status(502).json({ error: 'We could not send that just now.' });
  }

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative', email: SENDER },
      to: [{ email, name: String(body.name).trim() }],
      replyTo: { email: RECIPIENT },
      subject: 'We have your request',
      htmlContent:
        `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#111">` +
        `<p>Thanks — we have your request for ${esc(org)}.</p>` +
        `<p>Dakotah reads every one of these personally and will come back to you within two business days, either with a scoped quote or with the two or three questions needed to build one.</p>` +
        `<p>If it turns out we are not the right fit, we will say so plainly and point you somewhere better.</p>` +
        `<p style="margin-top:24px">— DakJen Creative<br>` +
        `<a href="https://dakjencreative.com" style="color:#c07481">dakjencreative.com</a></p></div>`,
    });
  } catch (err) {
    console.error('Quote confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
