// Quote request intake — emails the submission through Brevo.
// Requires BREVO_API_KEY. Optional: BREVO_SENDER (verified sender), SCAN_RECIPIENT.

const { sendEmail, layout, para, detailBlock, button, signature, esc } = require('./_email');
const { addContact, splitName } = require('./_contacts');
const { guard } = require('./_guard');

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const RECIPIENT = process.env.SCAN_RECIPIENT || 'business@dakjencreative.com';

const REQUIRED = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['organization', 'Organization'],
  ['service', 'What they need'],
  ['challenge', 'What they are trying to solve'],
];

const OPTIONAL = [
  ['phone', 'Phone'],
  ['timeline', 'Timeline'],
  ['budget', 'Budget range'],
  ['heard', 'How they heard about us'],
  ['notes', 'Anything else'],
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

  const stopped = guard(req, res, body);
  if (stopped) return stopped;

  const missing = REQUIRED.filter(([k]) => !String(body[k] || '').trim()).map(([, l]) => l);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

  const email = String(body.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address looks incomplete.' });
  }

  const name = String(body.name).trim();
  const org = String(body.organization).trim();
  const service = String(body.service).trim();

  const { firstName, lastName } = splitName(name);
  const stored = await addContact({ email, firstName, lastName, source: `quote request — ${service}` });

  const pairs = [...REQUIRED, ...OPTIONAL]
    .filter(([k]) => String(body[k] || '').trim())
    .map(([k, label]) => [label, String(body[k]).trim()])
    .concat([['Saved to Brevo', stored ? 'Yes' : 'No — add them manually']]);

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative — Site', email: SENDER },
      to: [{ email: RECIPIENT }],
      replyTo: { email, name },
      subject: `Quote request — ${org} — ${service}`,
      textContent: ['Quote request', ''].concat(pairs.map(([l, v]) => `${l}: ${v}`)).join('\n'),
      htmlContent: layout({
        eyebrow: 'New Lead — Quote Request',
        heading: `${org} wants a quote`,
        preheader: `${name} at ${org} — ${service}`,
        body: detailBlock(pairs) + para(`<a href="mailto:${esc(email)}" style="color:#c07481;">Reply to ${esc(name)}</a> — or just hit reply, this email is addressed to them.`),
        footerNote: 'Sent automatically from the quote form on dakjencreative.com/quote.html',
      }),
    });
  } catch (err) {
    console.error('Quote notification failed:', err.message);
    return res.status(502).json({ error: 'We could not send that just now.' });
  }

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative', email: SENDER },
      to: [{ email, name }],
      replyTo: { email: RECIPIENT },
      subject: 'We have your request',
      textContent:
        `Thanks — we have your request for ${org}.\n\n` +
        'Dakotah reads every one of these personally and will come back to you within ' +
        'two business days, either with a scoped quote or with the two or three questions ' +
        'needed to build one honestly.\n\n' +
        'If it turns out we are not the right fit, we will say so plainly and point you ' +
        'somewhere better.\n\n— DakJen Creative · dakjencreative.com',
      htmlContent: layout({
        eyebrow: 'Request Received',
        heading: 'We have it. Two business days.',
        preheader: 'Dakotah reads these personally — a scoped quote is coming.',
        body:
          para(`Thanks — we have your request for <strong>${esc(org)}</strong>.`) +
          para('Dakotah reads every one of these personally and will come back to you within two business days, either with a scoped quote or with the two or three questions we need to build one honestly.') +
          para('If it turns out we are not the right fit, we will say so plainly and point you somewhere better. Bad fits cost you more than they cost us.') +
          button('https://substack.com/@dakjencreative', 'Read The Fractional Founder') +
          signature({ email: 'business@dakjencreative.com', tel: '+12026009741', book: 'https://calendar.app.google/bzcyGsRcNRLTGce18' }),
        footerNote: 'You are receiving this because you submitted a request at dakjencreative.com.',
      }),
    });
  } catch (err) {
    console.error('Quote confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
