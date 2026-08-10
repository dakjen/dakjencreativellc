// "Stay in touch" intake — name and email only, for people who are
// interested but not ready to request a quote. Emails the submission
// through Brevo exactly like the quote form.
//
// Requires BREVO_API_KEY. Optional: BREVO_SENDER (verified sender), SCAN_RECIPIENT.

const { sendEmail, layout, para, detailBlock, button, esc } = require('./_email');
const { addContact, splitName } = require('./_contacts');

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const RECIPIENT = process.env.SCAN_RECIPIENT || 'business@dakjencreative.com';

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

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const source = String(body.source || 'site').trim().slice(0, 80);

  const missing = [];
  if (!name) missing.push('Name');
  if (!email) missing.push('Email');
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address looks incomplete.' });
  }

  // Store them in Brevo so the list is a list, not just an inbox.
  const { firstName, lastName } = splitName(name);
  const stored = await addContact({ email, firstName, lastName, source: `interested — ${source}` });

  const pairs = [
    ['Name', name],
    ['Email', email],
    ['Came from', source],
    ['Saved to Brevo', stored ? 'Yes' : 'No — add them manually'],
  ];

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative — Site', email: SENDER },
      to: [{ email: RECIPIENT }],
      replyTo: { email, name },
      subject: `Interested — ${name}`,
      textContent: ['Someone asked to be kept posted', '']
        .concat(pairs.map(([l, v]) => `${l}: ${v}`))
        .join('\n'),
      htmlContent: layout({
        eyebrow: 'New Contact — Interested',
        heading: `${name} wants to be kept posted`,
        preheader: `${name} — ${email}`,
        body:
          detailBlock(pairs) +
          para('Not a quote request. Someone who wants to stay near the work.') +
          para(`<a href="mailto:${esc(email)}" style="color:#c07481;">Reply to ${esc(name)}</a> — or just hit reply, this email is addressed to them.`),
        footerNote: 'Sent automatically from the stay-in-touch form on dakjencreative.com',
      }),
    });
  } catch (err) {
    console.error('Interest notification failed:', err.message);
    return res.status(502).json({ error: 'We could not send that just now.' });
  }

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative', email: SENDER },
      to: [{ email, name }],
      replyTo: { email: RECIPIENT },
      subject: "You're on our list",
      textContent:
        "You're on our list.\n\n" +
        'We do not send much — the occasional note when something is worth ' +
        'knowing, and nothing automated at you.\n\n' +
        'If you would rather read regularly, The Fractional Founder is where ' +
        'Dakotah writes: https://substack.com/@dakjencreative\n\n' +
        'Ready sooner than that? Tell us what you are trying to solve and we ' +
        'come back within two business days: https://dakjencreative.com/quote.html\n\n' +
        'Reply to this email any time — it reaches a person.\n\n' +
        '— DakJen Creative · dakjencreative.com',
      htmlContent: layout({
        eyebrow: 'Good to Meet You',
        heading: "You're on our list.",
        preheader: 'Occasional notes. Nothing automated at you.',
        body:
          para('We do not send much — the occasional note when something is worth knowing, and nothing automated at you.') +
          para('If you would rather read regularly, <strong>The Fractional Founder</strong> is where Dakotah writes about running a business and a brand at the same time.') +
          button('https://substack.com/@dakjencreative', 'Read The Fractional Founder') +
          para('Ready sooner than that? <a href="https://dakjencreative.com/quote.html" style="color:#c07481;">Tell us what you are trying to solve</a> and we come back within two business days.') +
          para('Reply to this email any time — it reaches a person, not a queue.'),
        footerNote: 'You are receiving this because you asked to be kept posted at dakjencreative.com. Reply with "remove" and you are off, no questions asked.',
      }),
    });
  } catch (err) {
    console.error('Interest confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
