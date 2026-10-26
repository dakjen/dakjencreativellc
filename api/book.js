// Create a booking on the calendar and confirm it by email.
//
// The requested slot is re-checked against a freshly derived list of open
// slots before anything is written, so a stale page, a double submit or a
// hand-crafted POST cannot book a time that is not actually free.
//
// Google will not email the invitee unless the service account is granted
// domain-wide delegation, so both confirmations go out over Brevo with an
// .ics attached for the visitor to add to their own calendar.

const { createEvent, partsInTz } = require('./_google');
const { openSlots, TZ, CALENDAR_ID, SLOT_MIN } = require('./_booking');
const { sendEmail, layout, para, detailBlock, signature, esc } = require('./_email');
const { addContact, splitName } = require('./_contacts');
const { guard } = require('./_guard');

const SENDER = process.env.BREVO_SENDER || 'business@dakjencreative.com';
const RECIPIENT = process.env.SCAN_RECIPIENT || 'business@dakjencreative.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fmt(iso, opts) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(new Date(iso));
}

function when(startIso, endIso) {
  const day = fmt(startIso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const from = fmt(startIso, { hour: 'numeric', minute: '2-digit', hour12: true });
  const to = fmt(endIso, { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  return `${day}, ${from}–${to}`;
}

function icsStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function buildIcs({ startIso, endIso, name, uid }) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DakJen Creative LLC//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(startIso)}`,
    `DTEND:${icsStamp(endIso)}`,
    `SUMMARY:${icsEscape(`Intro call — DakJen Creative & ${name}`)}`,
    `DESCRIPTION:${icsEscape('A 20-minute intro call with Dakotah Jennifer of DakJen Creative LLC. Dakotah will reach out with a link or call you directly.')}`,
    'ORGANIZER;CN=Dakotah Jennifer:mailto:business@dakjencreative.com',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Intro call with DakJen Creative',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY || !CALENDAR_ID) {
    console.error('Booking is not configured: missing Google env vars');
    return res.status(503).json({ error: 'Booking is not set up yet.' });
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
  const start = String(body.start || '').trim();
  const organization = String(body.organization || '').trim();
  const phone = String(body.phone || '').trim();
  const topic = String(body.topic || '').trim();

  if (!name || !email || !start) {
    return res.status(400).json({ error: 'Name, email and a time are all required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'That email address does not look right.' });
  }

  // Never trust the page about what is bookable — re-derive and match.
  let slot;
  try {
    const open = await openSlots();
    slot = open.find(s => s.start === start);
  } catch (err) {
    console.error('booking availability check failed:', err.message);
    return res.status(502).json({ error: 'Could not reach the calendar right now. Try again in a moment.' });
  }
  if (!slot) {
    return res.status(409).json({ error: 'That time was just taken or is no longer open. Pick another and we will grab it.' });
  }

  // Write it to the calendar.
  let event;
  try {
    event = await createEvent(CALENDAR_ID, {
      summary: `Intro call — ${name}${organization ? ` (${organization})` : ''}`,
      description: [
        'Booked from dakjencreative.com',
        '',
        `Name: ${name}`,
        organization ? `Organization: ${organization}` : null,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        '',
        topic ? `What they want to talk about:\n${topic}` : 'No topic given.',
      ].filter(Boolean).join('\n'),
      start: { dateTime: slot.start, timeZone: TZ },
      end: { dateTime: slot.end, timeZone: TZ },
      reminders: { useDefault: true },
    });
  } catch (err) {
    console.error('calendar insert failed:', err.message);
    return res.status(502).json({ error: 'We could not write that to the calendar. Email business@dakjencreative.com and we will book it by hand.' });
  }

  const readable = when(slot.start, slot.end);

  // Confirmations. The booking already exists, so email trouble must not
  // fail the request — it is reported in the logs, not to the visitor.
  const ics = buildIcs({ startIso: slot.start, endIso: slot.end, name, uid: `${event.id}@dakjencreative.com` });
  const attachment = [{ content: Buffer.from(ics).toString('base64'), name: 'intro-call.ics' }];

  try {
    await sendEmail({
      sender: { email: SENDER, name: 'DakJen Creative' },
      to: [{ email, name }],
      replyTo: { email: RECIPIENT, name: 'Dakotah Jennifer' },
      subject: `Confirmed: your intro call — ${readable}`,
      htmlContent: layout({
        to: email,
        eyebrow: 'Booking confirmed',
        heading: 'You are on the calendar.',
        preheader: `${readable}`,
        body: [
          para(`Thanks ${esc(name.split(' ')[0] || name)} — your intro call is booked. Dakotah will reach out shortly before with a link, or call you directly if you left a number.`),
          detailBlock([
            ['When', readable],
            ['Length', `${SLOT_MIN} minutes`],
            organization ? ['Organization', organization] : null,
            phone ? ['Phone', phone] : null,
          ].filter(Boolean)),
          para('The attached calendar file will add it to your own calendar. Need to move it? Just reply to this email.'),
          signature({ email: 'business@dakjencreative.com', tel: '+12026009741', book: 'https://www.dakjencreative.com/book' }),
        ].join(''),
      }),
      attachment,
    });
  } catch (err) {
    console.error('visitor confirmation failed:', err.message);
  }

  try {
    await sendEmail({
      sender: { email: SENDER, name: 'DakJen Creative' },
      to: [{ email: RECIPIENT, name: 'Dakotah Jennifer' }],
      replyTo: { email, name },
      subject: `New booking — ${name}${organization ? ` (${organization})` : ''}, ${readable}`,
      htmlContent: layout({
        eyebrow: 'New booking',
        heading: `${esc(name)} booked an intro call.`,
        preheader: readable,
        body: [
          detailBlock([
            ['When', readable],
            ['Name', name],
            organization ? ['Organization', organization] : null,
            ['Email', email],
            phone ? ['Phone', phone] : null,
            ['Topic', topic || '—'],
          ].filter(Boolean)),
          para('It is already on your calendar. Reply to this email to reach them directly.'),
        ].join(''),
      }),
      attachment,
    });
  } catch (err) {
    console.error('internal booking alert failed:', err.message);
  }

  try {
    const { firstName, lastName } = splitName(name);
    await addContact({ email, firstName, lastName, source: 'Booking' });
  } catch (err) {
    console.error('contact save failed:', err.message);
  }

  return res.status(200).json({ ok: true, when: readable, start: slot.start, end: slot.end });
};
