// Google Calendar access for the booking flow.
//
// Auth is a service-account JWT exchanged for an access token — signed here
// with Node's built-in crypto so the project stays dependency-free, the way
// the rest of /api already is.
//
// Required env (set in Vercel, never in the repo — this repo is public):
//   GOOGLE_SA_EMAIL        the service account's client_email
//   GOOGLE_SA_PRIVATE_KEY  its private_key (literal \n escapes are fine)
//   GOOGLE_CALENDAR_ID     the calendar shared with that service account
//
// Note: a service account acting as itself cannot invite attendees —
// Google requires domain-wide delegation for that, which is a separate
// Workspace admin grant on top of the calendar share. Until that is set
// up the booking event is written without an attendee list and the
// confirmation is sent separately over Brevo.

const crypto = require('crypto');

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const CAL_API = 'https://www.googleapis.com/calendar/v3';

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function privateKey() {
  const raw = process.env.GOOGLE_SA_PRIVATE_KEY || '';
  // Vercel stores the key as a single line with escaped newlines
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

let cached = { token: null, exp: 0 };

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;

  const email = process.env.GOOGLE_SA_EMAIL;
  const key = privateKey();
  if (!email || !key) throw new Error('Google service account env vars are missing');

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600,
  }));
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);

  const json = await res.json();
  cached = { token: json.access_token, exp: now + (json.expires_in || 3600) };
  return cached.token;
}

async function calendar(path, options = {}) {
  const token = await accessToken();
  const res = await fetch(`${CAL_API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Calendar ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ---------------- time zones, without a date library ---------------- */

// How far the given instant's wall clock in `tz` is from UTC, in minutes.
function tzOffsetMinutes(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
  const asUTC = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second,
  );
  return (asUTC - date.getTime()) / 60000;
}

// A wall-clock time in `tz` -> the UTC instant. Applied twice so the result
// is still right on the days clocks change.
function zonedToUtc(y, m, d, h, min, tz) {
  const naive = Date.UTC(y, m - 1, d, h, min, 0);
  let guess = new Date(naive - tzOffsetMinutes(new Date(naive), tz) * 60000);
  guess = new Date(naive - tzOffsetMinutes(guess, tz) * 60000);
  return guess;
}

// Calendar parts of an instant as seen in `tz`.
function partsInTz(date, tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour % 24, minute: +p.minute,
    weekday: weekdays[p.weekday],
    date: `${p.year}-${p.month}-${p.day}`,
  };
}

/* ---------------- calendar operations ---------------- */

async function busyIntervals(calendarId, timeMin, timeMax) {
  const data = await calendar('/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    }),
  });
  const cal = (data.calendars || {})[calendarId] || {};
  if (cal.errors && cal.errors.length) {
    throw new Error(`freeBusy: ${JSON.stringify(cal.errors)}`);
  }
  return (cal.busy || []).map(b => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
}

async function createEvent(calendarId, event) {
  return calendar(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

module.exports = {
  accessToken, calendar, busyIntervals, createEvent,
  tzOffsetMinutes, zonedToUtc, partsInTz,
};
