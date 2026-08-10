// Opportunity Scan intake — posts the form to Brevo's transactional email API.
// Requires BREVO_API_KEY in the Vercel project environment.
// Optional: BREVO_SENDER (must be a verified sender in Brevo), SCAN_RECIPIENT.

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const RECIPIENT = process.env.SCAN_RECIPIENT || 'business@dakjencreative.com';

const FIELDS = [
  ['name', 'Name'],
  ['firm', 'Firm'],
  ['email', 'Email'],
  ['certs', 'Certifications held'],
  ['naics', 'NAICS codes'],
  ['geography', 'Geography'],
  ['size', 'Target contract size'],
  ['capacity', 'Current bid capacity'],
  ['sector', 'Sector'],
];

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

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
  if (!res.ok) {
    throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  }
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

  // Honeypot — real people leave this empty.
  if (body.website) return res.status(200).json({ ok: true });

  const missing = FIELDS.filter(([key]) => !String(body[key] || '').trim()).map(
    ([, label]) => label
  );
  if (missing.length) {
    return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  }

  const email = String(body.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address looks incomplete.' });
  }

  const rows = FIELDS.map(
    ([key, label]) =>
      `<tr><td style="padding:6px 14px 6px 0;color:#777;white-space:nowrap;vertical-align:top">${label}</td>` +
      `<td style="padding:6px 0;color:#111">${esc(body[key])}</td></tr>`
  ).join('');

  const firm = String(body.firm).trim();

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative — Site', email: SENDER },
      to: [{ email: RECIPIENT }],
      replyTo: { email, name: String(body.name).trim() },
      subject: `Opportunity Scan request — ${firm}`,
      htmlContent:
        `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6">` +
        `<p style="margin:0 0 18px"><strong>Opportunity Scan request</strong></p>` +
        `<table style="border-collapse:collapse;font-size:14px">${rows}</table>` +
        `<p style="margin:22px 0 0;color:#777;font-size:13px">Reply directly to this email to reach ${esc(
          body.name
        )}.</p></div>`,
    });
  } catch (err) {
    console.error('Opportunity Scan notification failed:', err.message);
    return res.status(502).json({ error: 'We could not send that just now.' });
  }

  // Confirmation to the requester. A failure here must not fail the request —
  // the lead is already captured above.
  try {
    await sendEmail({
      sender: { name: 'DakJen Creative', email: SENDER },
      to: [{ email, name: String(body.name).trim() }],
      replyTo: { email: RECIPIENT },
      subject: 'Your Opportunity Scan is underway',
      htmlContent:
        `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.7;color:#111">` +
        `<p>Thanks — we have your Opportunity Scan request for ${esc(firm)}.</p>` +
        `<p>Within 48 hours you will get back three to five live opportunities you are currently positioned to pursue: real solicitations, real deadlines. If nothing in our fit filter matches what you do, we will tell you that instead rather than send you a padded list.</p>` +
        `<p>Nothing is required from you in the meantime.</p>` +
        `<p style="margin-top:24px">— DakJen Creative<br>` +
        `<a href="https://dakjencreative.com" style="color:#c07481">dakjencreative.com</a></p></div>`,
    });
  } catch (err) {
    console.error('Opportunity Scan confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
