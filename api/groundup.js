// Ground Up member offer — RFP design & light editing intake.
// Emails Dakotah a full brief with a suggested member quote, confirms to the
// member, and saves them to Brevo. Requires BREVO_API_KEY.
// Optional: GROUNDUP_CODE (the member code to check against), BREVO_SENDER, SCAN_RECIPIENT.

const {
  sendEmail, layout, para, detailBlock, button, sectionTitle, esc,
} = require('./_email');
const { addContact, splitName } = require('./_contacts');

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const RECIPIENT = process.env.SCAN_RECIPIENT || 'business@dakjencreative.com';
const MEMBER_CODE = (process.env.GROUNDUP_CODE || '').trim();

const REQUIRED = [
  ['name', 'Name'],
  ['company', 'Company'],
  ['email', 'Email'],
  ['code', 'Ground Up member code'],
  ['rfp', 'Solicitation / RFP'],
  ['due', 'Submission due date'],
  ['turnaround', 'Turnaround needed'],
  ['length', 'Response length'],
  ['appendices', 'Appendices'],
  ['draft', 'Draft status'],
];
const OPTIONAL = [
  ['phone', 'Phone'],
  ['agency', 'Issuing agency'],
  ['brand', 'Brand assets on hand'],
  ['format', 'Deliverable format'],
  ['link', 'Link to the solicitation'],
  ['notes', 'Notes'],
];

// Suggested member quote: a rubric, not a rule. Dakotah sends the real number.
// Member range is $500–$2,000 (standard $1,500–$2,500).
function suggestQuote(f) {
  const base = {
    'Under 15 pages': 500,
    '15–30 pages': 850,
    '30–60 pages': 1200,
    '60+ pages': 1600,
  }[f.length] || 850;
  const add = {
    'No appendices': 0,
    'Light — résumés, forms, a few attachments': 150,
    'Heavy — exhibits, multiple attachments, past-performance packets': 300,
  }[f.appendices] || 0;
  const mult = {
    'Standard — 5+ business days': 1.0,
    'Rush — 3–4 business days': 1.15,
    'Urgent — 1–2 business days': 1.3,
    'Same day': 1.5,
  }[f.turnaround] || 1.0;
  const draftAdd = {
    'Complete and compiled': 0,
    'Mostly there — a few sections still open': 100,
    'Still being written': 200,
  }[f.draft] || 0;
  const raw = (base + add + draftAdd) * mult;
  const clamp = (n) => Math.min(2000, Math.max(500, Math.round(n / 50) * 50));
  return { low: clamp(raw * 0.9), high: clamp(raw * 1.1), mult };
}

const money = (n) => '$' + n.toLocaleString('en-US');

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
  if (body.website) return res.status(200).json({ ok: true }); // honeypot

  const f = {};
  [...REQUIRED, ...OPTIONAL].forEach(([k]) => { f[k] = String(body[k] || '').trim().slice(0, 2000); });

  const missing = REQUIRED.filter(([k]) => !f[k]).map(([, l]) => l);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
    return res.status(400).json({ error: 'That email address looks incomplete.' });
  }

  const codeOk = MEMBER_CODE ? f.code.toLowerCase() === MEMBER_CODE.toLowerCase() : null;
  const codeLine = codeOk === null ? f.code
                 : codeOk ? `${f.code} ✓`
                 : `${f.code} ✗ — not the member code; verify before quoting member pricing`;

  const q = suggestQuote(f);
  const { firstName, lastName } = splitName(f.name);
  const stored = await addContact({ email: f.email, firstName, lastName, source: 'Ground Up member — RFP design offer' });

  const pairs = [
    ['Member code', codeLine],
    ...REQUIRED.filter(([k]) => k !== 'code').map(([k, l]) => [l, f[k]]),
    ...OPTIONAL.filter(([k]) => f[k]).map(([k, l]) => [l, f[k]]),
    ['Saved to Brevo', stored ? 'Yes' : 'No — add them manually'],
  ];

  const quoteText =
    `Suggested member quote: ${money(q.low)}–${money(q.high)}` +
    (q.mult > 1 ? ` (includes a ${Math.round((q.mult - 1) * 100)}% rush factor for "${f.turnaround}")` : '') +
    ` — standard rate would be roughly ${money(Math.min(2500, q.low + 1000))}–${money(Math.min(2500, q.high + 1000))}.`;

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative — Site', email: SENDER },
      to: [{ email: RECIPIENT }],
      replyTo: { email: f.email, name: f.name },
      subject: `Ground Up offer used — ${f.company} · due ${f.due}`,
      textContent: [`Someone used the Ground Up offer`, '', quoteText, ''].concat(pairs.map(([l, v]) => `${l}: ${v}`)).join('\n'),
      htmlContent: layout({
        eyebrow: 'Ground Up — Member Offer Used',
        heading: `${f.company} wants RFP design for a ${f.due} deadline`,
        preheader: `${f.name} at ${f.company} · ${f.turnaround} · ${f.length}`,
        body:
          para(`<strong style="color:#0c1c2c;">${esc(quoteText)}</strong>`) +
          para('<span style="font-size:14px;color:#5b6672;">Rubric: base by length, plus appendices and draft state, times a turnaround factor, clamped to the $500–$2,000 member range. Your call — this is a starting point.</span>') +
          sectionTitle('The brief') +
          detailBlock(pairs) +
          (f.link ? para(`<a href="${esc(f.link)}" style="color:#c07481;">Open the solicitation</a>`) : '') +
          para(`<a href="mailto:${esc(f.email)}?subject=${encodeURIComponent('Your Ground Up member quote — ' + f.rfp)}" style="color:#c07481;">Send ${esc(f.name)} the quote</a> — or just hit reply, this email is addressed to them.`),
        footerNote: 'Sent automatically from the Ground Up member form on dakjencreative.com/groundup',
      }),
    });
  } catch (err) {
    console.error('Ground Up notification failed:', err.message);
    return res.status(502).json({ error: 'We could not send that just now.' });
  }

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative', email: SENDER },
      to: [{ email: f.email, name: f.name }],
      replyTo: { email: RECIPIENT },
      subject: `We have your RFP brief — ${f.rfp}`,
      textContent:
        `Thanks, ${firstName || f.name} — we have your brief for ${f.rfp}, due ${f.due}.\n\n` +
        'Dakotah will confirm scope and your Ground Up member pricing in writing, usually within one business day. ' +
        'Nothing is required from you until then.\n\n' +
        'When you are ready, send the compiled draft and any brand assets to business@dakjencreative.com.\n\n' +
        '— DakJen Creative · dakjencreative.com',
      htmlContent: layout({
        eyebrow: 'Ground Up Member Offer',
        heading: 'We have your brief. Your quote is on its way.',
        preheader: `${f.rfp} — due ${f.due}. Dakotah will reply with member pricing.`,
        body:
          para(`Thanks, <strong>${esc(firstName || f.name)}</strong> — we have your brief for <strong>${esc(f.rfp)}</strong>, due ${esc(f.due)}.`) +
          para('Dakotah will confirm scope and your Ground Up member pricing in writing, usually within one business day. Nothing is required from you until then.') +
          para('When you are ready, send the compiled draft and any brand assets to <a href="mailto:business@dakjencreative.com" style="color:#c07481;">business@dakjencreative.com</a>.') +
          button('https://dakjencreative.com/groundup', 'Review the member offer'),
        footerNote: 'You are receiving this because you submitted the Ground Up member form at dakjencreative.com/groundup.',
      }),
    });
  } catch (err) {
    console.error('Ground Up confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
