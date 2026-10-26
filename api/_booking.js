// Booking rules, in one place.
//
// Both /api/availability and /api/book import this, so the slots the page
// offers and the slots the server will accept can never drift apart. The
// booking endpoint re-derives the slot list itself and refuses anything
// that is not on it — the browser is never trusted about what is bookable.

const { busyIntervals, zonedToUtc, partsInTz } = require('./_google');

const TZ          = process.env.BOOKING_TZ || 'America/New_York';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '';

const SLOT_MIN    = Number(process.env.BOOKING_SLOT_MIN || 20);  // "20-minute fit call"
const PAD_MIN     = Number(process.env.BOOKING_PAD_MIN  || 10);  // breathing room around meetings
const LEAD_HOURS  = Number(process.env.BOOKING_LEAD_HRS || 12);  // no same-afternoon surprises
const DAYS_OUT    = Number(process.env.BOOKING_DAYS_OUT || 21);
const START_HOUR  = Number(process.env.BOOKING_START_HR || 10);  // 10:00 local
const END_HOUR    = Number(process.env.BOOKING_END_HR   || 17);  // last slot ends by 17:00
const WORK_DAYS   = (process.env.BOOKING_WORK_DAYS || '1,2,3,4,5')
  .split(',').map(n => Number(n.trim()));

function overlaps(startMs, endMs, busy) {
  const a = startMs - PAD_MIN * 60000;
  const b = endMs + PAD_MIN * 60000;
  return busy.some(x => x.start < b && x.end > a);
}

// Every slot that is genuinely open, as UTC instants.
async function openSlots() {
  if (!CALENDAR_ID) throw new Error('GOOGLE_CALENDAR_ID is not set');

  const now = Date.now();
  const earliest = now + LEAD_HOURS * 3600000;
  const windowStart = new Date(now);
  const windowEnd = new Date(now + DAYS_OUT * 86400000);

  const busy = await busyIntervals(CALENDAR_ID, windowStart, windowEnd);

  const slots = [];
  for (let i = 0; i <= DAYS_OUT; i++) {
    const dayParts = partsInTz(new Date(now + i * 86400000), TZ);
    if (!WORK_DAYS.includes(dayParts.weekday)) continue;

    for (let min = START_HOUR * 60; min + SLOT_MIN <= END_HOUR * 60; min += SLOT_MIN) {
      const start = zonedToUtc(
        dayParts.year, dayParts.month, dayParts.day,
        Math.floor(min / 60), min % 60, TZ,
      );
      const startMs = start.getTime();
      const endMs = startMs + SLOT_MIN * 60000;

      if (startMs < earliest) continue;
      if (startMs > windowEnd.getTime()) continue;
      if (overlaps(startMs, endMs, busy)) continue;

      slots.push({ start: start.toISOString(), end: new Date(endMs).toISOString() });
    }
  }
  return slots;
}

// Slots grouped by local day, for rendering.
function groupByDay(slots) {
  const days = new Map();
  for (const s of slots) {
    const p = partsInTz(new Date(s.start), TZ);
    const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    if (!days.has(key)) {
      days.set(key, {
        date: key,
        label: new Intl.DateTimeFormat('en-US', {
          timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric',
        }).format(new Date(s.start)),
        slots: [],
      });
    }
    days.get(key).slots.push({
      start: s.start,
      end: s.end,
      label: new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true,
      }).format(new Date(s.start)),
    });
  }
  return [...days.values()];
}

module.exports = {
  openSlots, groupByDay,
  TZ, CALENDAR_ID, SLOT_MIN, LEAD_HOURS, DAYS_OUT,
};
