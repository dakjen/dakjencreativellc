// "Stay in touch" intake — name and email only, for people who are
// interested but not ready to request a quote. Emails the submission
// through Brevo exactly like the quote form.
//
// Requires BREVO_API_KEY. Optional: BREVO_SENDER (verified sender), SCAN_RECIPIENT.

const {
  sendEmail, layout, para, detailBlock, linkList, statList, sectionTitle, contactRow, signature, esc,
} = require('./_email');
const { addContact, splitName } = require('./_contacts');
const { guard } = require('./_guard');

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const CONTACT_EMAIL = 'business@dakjencreative.com';
const CONTACT_TEL = '+12026009741';
const BOOKING = 'https://calendar.app.google/bzcyGsRcNRLTGce18';
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

  const stopped = guard(req, res, body);
  if (stopped) return stopped;

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
      subject: 'Thanks for reaching out',
      textContent:
        `Thanks for showing interest, ${name}.\n\n` +
        'Dakotah will reach out personally and get back to you shortly.\n\n' +
        'WHAT WE DO\n' +
        '  Fractional creative & business leadership — a Brand Manager, Marketing\n' +
        '  Director, or Chief Creative Officer inside your business, covering brand\n' +
        '  direction and the business management around it. From $2,000/mo.\n\n' +
        '  RFP pipeline — we monitor the procurement portals, flag what fits your\n' +
        '  certifications, and hand you a finished Draft 1. From $750/mo.\n\n' +
        '  Done-for-you production (The CMO Subscription) — content and collateral\n' +
        '  on a flat monthly rate. From $1,500/mo.\n\n' +
        '  Brand platforms (Notable) — positioning, websites, decks, and revenue\n' +
        '  streams for founders.\n\n' +
        '  Lease-up marketing — full-cycle campaigns for affordable housing\n' +
        '  developers. Campaigns start at $20,000, all in.\n\n' +
        'SOME OF WHAT WE HAVE DONE\n' +
        '  400+ qualified inquiries in the first 48 hours of our 9410 Hough\n' +
        '  lease-up campaign, a 116-unit development in Cleveland.\n' +
        '  36.2% applicant qualification rate on that campaign — 13.7 points\n' +
        '  above the industry benchmark.\n' +
        '  237% LinkedIn network growth over a five-year brand engagement,\n' +
        '  1,645 to 5,543 connections.\n\n' +
        'MDOT-certified MBE and SBE (Maryland). SAM.gov registered, UEI DEN5Y8TUCTJ1.\n\n' +
        'GET TO KNOW US\n' +
        '  One-pagers for every service — https://www.dakjencreative.com/onepagers\n' +
        '  The Fractional Founder — https://substack.com/@dakjencreative\n' +
        '  LinkedIn — https://www.linkedin.com/in/dakotah-jennifer-mfa-a89857170/\n' +
        '  The site — https://www.dakjencreative.com\n\n' +
        'REACH DAKOTAH DIRECTLY\n' +
        `  Email ${CONTACT_EMAIL}  ·  Text ${CONTACT_TEL}  ·  Book a call ${BOOKING}\n\n` +
        '— DakJen Creative · dakjencreative.com',
      htmlContent: layout({
        eyebrow: 'Thanks for Reaching Out',
        heading: 'Thanks — we will be in touch.',
        preheader: 'Dakotah will get back to you. Here is everything we do in the meantime.',
        body:
          para(`Thanks for showing interest, <strong>${esc(name.split(' ')[0] || name)}</strong>. Dakotah will reach out personally and get back to you shortly — no form letter, no queue.`) +
          para('In the meantime, here is the whole picture, so you know what you are dealing with.') +

          sectionTitle('What we do') +
          linkList([
            {
              href: 'https://www.dakjencreative.com/fractional.html',
              label: 'Fractional creative & business leadership',
              note: 'A Brand Manager, Marketing Director, or Chief Creative Officer inside your business — brand direction plus the business management around it. From $2,000/mo.',
            },
            {
              href: 'https://www.dakjencreative.com/rfp.html',
              label: 'RFP pipeline',
              note: 'We monitor the procurement portals, flag what fits your certifications, and hand you a finished Draft 1 plus a requirements checklist. From $750/mo.',
            },
            {
              href: 'https://www.dakjencreative.com/fractional.html',
              label: 'Done-for-you production — The CMO Subscription',
              note: 'Content and collateral handled on a flat monthly rate. A marketing agency in your back pocket. From $1,500/mo.',
            },
            {
              href: 'https://www.dakjencreative.com/notable.html',
              label: 'Brand platforms — Notable',
              note: 'Positioning, websites, decks, and revenue streams for founders.',
            },
            {
              href: 'https://www.dakjencreative.com/leaseup.html',
              label: 'Lease-up marketing',
              note: 'Full-cycle campaigns for affordable housing developers, pre-leasing through stabilization. Campaigns start at $20,000, all in.',
            },
          ]) +

          sectionTitle('Some of what we have done') +
          statList([
            {
              figure: '400+',
              note: 'Qualified inquiries in the first 48 hours of our 9410 Hough lease-up campaign — a 116-unit development in Cleveland.',
            },
            {
              figure: '36.2%',
              note: 'Applicant qualification rate on that campaign, 13.7 points above the industry benchmark of 15–30%.',
            },
            {
              figure: '237%',
              note: 'LinkedIn network growth over a five-year brand engagement — 1,645 to 5,543 connections.',
            },
          ]) +
          para('<span style="font-size:14px;color:#5b6672;">MDOT-certified MBE and SBE in Maryland. SAM.gov registered, UEI DEN5Y8TUCTJ1. WBENC-certified WBE and WOSB.</span>') +

          sectionTitle('Get to know us, no commitment') +
          linkList([
            {
              href: 'https://www.dakjencreative.com/onepagers',
              label: 'One-pagers for every service',
              note: 'A single PDF per service line — the fastest way to see whether something fits, and easy to forward to whoever else needs to see it.',
            },
            {
              href: 'https://substack.com/@dakjencreative',
              label: 'The Fractional Founder',
              note: 'Dakotah writes on running a business and a brand at the same time.',
            },
            {
              href: 'https://www.linkedin.com/in/dakotah-jennifer-mfa-a89857170/',
              label: 'Follow along on LinkedIn',
              note: 'Day to day, and the work as it happens.',
            },
          ]) +

          sectionTitle('Reach Dakotah directly') +
          contactRow({ email: CONTACT_EMAIL, tel: CONTACT_TEL, book: BOOKING }) +
          para('<span style="font-size:14px;color:#5b6672;">Or just reply to this email — it reaches a person, not a queue.</span>') +
          signature({ email: CONTACT_EMAIL, tel: CONTACT_TEL, book: BOOKING }),
        footerNote: 'You are receiving this because you asked to be kept posted at dakjencreative.com. Reply with "remove" and you are off, no questions asked.',
      }),
    });
  } catch (err) {
    console.error('Interest confirmation failed:', err.message);
  }

  return res.status(200).json({ ok: true });
};
