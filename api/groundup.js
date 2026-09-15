// Ground Up member offer — RFP design & light editing intake.
// Emails Dakotah a full brief with a suggested member quote, confirms to the
// member, and saves them to Brevo. Requires BREVO_API_KEY.
// Optional: BREVO_SENDER, SCAN_RECIPIENT.

const {
  sendEmail, layout, para, detailBlock, button, sectionTitle, esc,
} = require('./_email');
const { addContact, splitName } = require('./_contacts');

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const RECIPIENT = process.env.SCAN_RECIPIENT || 'business@dakjencreative.com';

const REQUIRED = [
  ['name', 'Name'],
  ['company', 'Company'],
  ['email', 'Email'],
  ['code', 'Ground Up member code'],
  ['rfp', 'Solicitation / RFP'],
  ['due', 'Submission due date'],
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
  ['materials', 'Materials they can send'],
  ['folder', 'Shared folder'],
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
  const draftAdd = {
    'Complete and compiled': 0,
    'Mostly there — a few sections still open': 100,
    'Still being written': 200,
  }[f.draft] || 0;
  // urgency comes from the due date alone: inside a week is urgent, inside 48 hours more so
  const days = daysUntil(f.due);
  const factor = days === null ? 1.0 : days <= 2 ? 1.5 : days <= 7 ? 1.3 : 1.0;
  const raw = (base + add + draftAdd) * factor;
  const clamp = (n) => Math.min(2000, Math.max(500, Math.round(n / 50) * 50));
  return { low: clamp(raw * 0.9), high: clamp(raw * 1.1), mult: factor, days };
}

function daysUntil(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d)) return null;
  const now = new Date(); now.setHours(12, 0, 0, 0);
  return Math.round((d - now) / 86400000);
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

  // The code is shown as typed; Dakotah knows whether it's right.
  const codeLine = f.code;

  const q = suggestQuote(f);
  const { firstName, lastName } = splitName(f.name);
  const stored = await addContact({ email: f.email, firstName, lastName, source: 'Ground Up member — RFP design offer' });

  const pairs = [
    ['Member code', codeLine],
    ...REQUIRED.filter(([k]) => k !== 'code').map(([k, l]) => [l, f[k]]),
    ...OPTIONAL.filter(([k]) => f[k]).map(([k, l]) => [l, f[k]]),
    ['Saved to Brevo', stored ? 'Yes' : 'No — add them manually'],
  ];

  const urgency = q.days !== null && q.days <= 7
    ? ` — DUE IN ${q.days} DAY${q.days === 1 ? '' : 'S'}, urgency fee applies`
    : '';
  const quoteText =
    `Suggested member quote: ${money(q.low)}–${money(q.high)}` +
    (q.mult > 1 ? ` (includes a ${Math.round((q.mult - 1) * 100)}% urgency factor${urgency})` : '') +
    ` — standard rate would be roughly ${money(Math.min(2500, q.low + 1000))}–${money(Math.min(2500, q.high + 1000))}.`;

  try {
    await sendEmail({
      sender: { name: 'DakJen Creative — Site', email: SENDER },
      to: [{ email: RECIPIENT }],
      replyTo: { email: f.email, name: f.name },
      subject: `Ground Up offer used — ${f.company} · due ${f.due}${q.days !== null && q.days <= 7 ? ' · URGENT' : ''}`,
      textContent: [`Someone used the Ground Up offer`, '', quoteText, ''].concat(pairs.map(([l, v]) => `${l}: ${v}`)).join('\n'),
      htmlContent: layout({
        eyebrow: 'Ground Up — Member Offer Used',
        heading: `${f.company} wants RFP design for a ${f.due} deadline`,
        preheader: `${f.name} at ${f.company} · due ${f.due} · ${f.length}`,
        body:
          para(`<strong style="color:#0c1c2c;">${esc(quoteText)}</strong>`) +
          para('<span style="font-size:14px;color:#5b6672;">Rubric: base by length, plus appendices and draft state, times an urgency factor from the due date, clamped to the $500–$2,000 member range. Your call — this is a starting point.</span>') +
          sectionTitle('The brief') +
          detailBlock(pairs) +
          (f.link ? para(`<a href="${esc(f.link)}" style="color:#c07481;">Open the solicitation</a>`) : '') +
          (f.folder ? para(`<a href="${esc(f.folder)}" style="color:#c07481;">Open their shared folder</a>`) : '') +
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
        'Dakotah will confirm scope and your Ground Up member pricing in writing, usually within one business day.\n\n' +
        'WHAT TO SEND US\n' +
        'The proposal is only as complete as what we have to build it from. Reply to this email (or share a folder) with:\n' +
        '  - The compiled draft\n' +
        '  - Team résumés / bios for everyone named in the response\n' +
        '  - Capability statement, company overview, and past-performance or project sheets\n' +
        '  - Certifications and any required forms already filled\n' +
        '  - Logo and brand guide, if you have them\n' +
        '  - Previous proposals we can build from, if any\n\n' +
        'A Google Drive, Dropbox, or Box link is easiest for anything large.\n\n' +
        '— DakJen Creative · dakjencreative.com',
      htmlContent: layout({
        eyebrow: 'Ground Up Member Offer',
        heading: 'We have your brief. Your quote is on its way.',
        preheader: `${f.rfp} — due ${f.due}. Dakotah will reply with member pricing.`,
        body:
          para(`Thanks, <strong>${esc(firstName || f.name)}</strong> — we have your brief for <strong>${esc(f.rfp)}</strong>, due ${esc(f.due)}.`) +
          para('Dakotah will confirm scope and your Ground Up member pricing in writing, usually within one business day.') +
          sectionTitle('What to send us') +
          para('The proposal is only as complete as what we have to build it from. Reply to this email — or share a folder — with:') +
          para('<strong>The compiled draft</strong><br>' +
               '<strong>Team résumés / bios</strong> for everyone named in the response<br>' +
               '<strong>Capability statement</strong>, company overview, and past-performance or project sheets<br>' +
               '<strong>Certifications</strong> and any required forms already filled<br>' +
               '<strong>Logo and brand guide</strong>, if you have them<br>' +
               '<strong>Previous proposals</strong> we can build from, if any') +
          para('<span style="font-size:14px;color:#5b6672;">A Google Drive, Dropbox, or Box link is easiest for anything large. Reply-to on this email goes straight to Dakotah.</span>') +
          button('https://dakjencreative.com/groundup', 'Review the member offer'),
        footerNote: 'You are receiving this because you submitted the Ground Up member form at dakjencreative.com/groundup.',
      }),
    });
  } catch (err) {
    console.error('Ground Up confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
