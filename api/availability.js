// Open booking slots, grouped by day.
//
// Read-only: it never writes to the calendar and never exposes event
// details — only "this window is free". Cached briefly so a visitor
// clicking through days does not re-query Google every time.

const { openSlots, groupByDay, TZ, SLOT_MIN } = require('./_booking');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY || !process.env.GOOGLE_CALENDAR_ID) {
    console.error('Booking is not configured: missing Google env vars');
    return res.status(503).json({ error: 'Booking is not set up yet.' });
  }

  try {
    const days = groupByDay(await openSlots());
    res.setHeader('cache-control', 'public, max-age=60, s-maxage=60');
    return res.status(200).json({ timezone: TZ, durationMinutes: SLOT_MIN, days });
  } catch (err) {
    console.error('availability failed:', err.message);
    return res.status(502).json({ error: 'Could not reach the calendar right now.' });
  }
};
