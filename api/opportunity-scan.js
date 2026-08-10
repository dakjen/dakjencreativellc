// Opportunity Scan intake — emails the submission through Brevo.
// Requires BREVO_API_KEY. Optional: BREVO_SENDER (verified sender), SCAN_RECIPIENT.

const { sendEmail, layout, para, detailBlock, button, esc } = require('./_email');

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
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Malformed request.' }); }
  }
  body = body || {};

  if (body.website) return res.status(200).json({ ok: true });

  const missing = FIELDS.filter(([k]) => !String(body[k] || '').trim()).map(([, l]) => l);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

  const email = String(body.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address looks incomplete.' });
  }

  const name = String(body.name).trim();
  const firm = String(body.firm).trim();
  const pairs = FIELDS.map(([k, label]) => [label, String(body[k] || '').trim()]);

  const textLines = ['Opportunity Scan request', ''].concat(
    pairs.map(([l, v]) => `${l}: ${v}`)
  );

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative — Site', email: SENDER },
      to: [{ email: RECIPIENT }],
      replyTo: { email, name },
      subject: `Opportunity Scan request — ${firm}`,
      textContent: textLines.join('\n'),
      htmlContent: layout({
        eyebrow: 'New Lead — RFP Pipeline',
        heading: `Opportunity Scan request from ${firm}`,
        preheader: `${name} at ${firm} wants an Opportunity Scan.`,
        body: detailBlock(pairs) + para(`<a href="mailto:${esc(email)}" style="color:#c07481;">Reply to ${esc(name)}</a> — or just hit reply, this email is addressed to them.`),
        footerNote: 'Sent automatically from the Opportunity Scan form on dakjencreative.com/rfp.html',
      }),
    });
  } catch (err) {
    console.error('Opportunity Scan notification failed:', err.message);
    return res.status(502).json({ error: 'We could not send that just now.' });
  }

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative', email: SENDER },
      to: [{ email, name }],
      replyTo: { email: RECIPIENT },
      subject: 'Your Opportunity Scan is underway',
      textContent:
        `Thanks — we have your Opportunity Scan request for ${firm}.\n\n` +
        'Within 48 hours you will get back three to five live opportunities you are ' +
        'currently positioned to pursue: real solicitations, real deadlines. If nothing ' +
        'in our fit filter matches what you do, we will tell you that instead rather than ' +
        'send you a padded list.\n\nNothing is required from you in the meantime.\n\n' +
        '— DakJen Creative · dakjencreative.com',
      htmlContent: layout({
        eyebrow: 'Opportunity Scan',
        heading: 'We have your request. Give us 48 hours.',
        preheader: 'Three to five live opportunities, coming within 48 hours.',
        body:
          para(`Thanks — we have your Opportunity Scan request for <strong>${esc(firm)}</strong>.`) +
          para('Within 48 hours you will get back three to five live opportunities you are currently positioned to pursue. Real solicitations, real deadlines — not a sample report.') +
          para('If nothing in our fit filter matches what you do, we will tell you that instead rather than send you a padded list.') +
          para('Nothing is required from you in the meantime.') +
          button('https://dakjencreative.com/rfp.html', 'Review how the pipeline works'),
        footerNote: 'You are receiving this because you requested an Opportunity Scan at dakjencreative.com.',
      }),
    });
  } catch (err) {
    console.error('Opportunity Scan confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
