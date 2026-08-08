// Shared helpers for the booking API.
// Storage is Redis over Upstash's REST API (what Vercel provisions for KV /
// Marketplace Redis). Env var names differ depending on how the store was
// attached, so accept every variant rather than forcing one.

export const REDIS_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_URL ||
  '';

export const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_TOKEN ||
  '';

export const CONFIGURED = Boolean(REDIS_URL && REDIS_TOKEN);

// Booking window - must match the front end.
export const OPEN_MIN = 14 * 60;       // 14:00 Dubai
export const CLOSE_MIN = 18 * 60 + 30; // last start 18:30
export const STEP_MIN = 30;
export const MAX_DAYS_AHEAD = 30;

const ALLOWED_ORIGINS = [
  'https://nuevoautomations.com',
  'https://www.nuevoautomations.com',
  'http://localhost:8743'
];

export function cors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// Fire a SINGLE Redis command. The Upstash base URL accepts one command array.
export async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error('redis ' + r.status + ': ' + (await r.text()));
  const json = await r.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

// Run several commands in one round trip.
// IMPORTANT: pipelines go to `${REDIS_URL}/pipeline`. Posting an array of
// command arrays to the base URL returns 400 - that was a real bug here.
export async function redisPipeline(commands) {
  const r = await fetch(REDIS_URL.replace(/\/+$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!r.ok) throw new Error('redis pipeline ' + r.status + ': ' + (await r.text()));
  return r.json();
}

// Today's date as seen in Dubai (UTC+4, no DST).
export function dubaiToday() {
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}

export function isValidDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return false;
  const today = dubaiToday();
  if (d < today) return false;
  const max = new Date(Date.UTC(
    Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10))
  ));
  max.setUTCDate(max.getUTCDate() + MAX_DAYS_AHEAD);
  return d <= max.toISOString().slice(0, 10);
}

export function isValidTime(t) {
  if (!/^\d{2}:\d{2}$/.test(t || '')) return false;
  const mins = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  if (mins < OPEN_MIN || mins > CLOSE_MIN) return false;
  return (mins - OPEN_MIN) % STEP_MIN === 0;
}

// Strip control characters, trim, cap length. Codepoint scan rather than a
// regex so no literal control bytes end up in source.
export function clean(s, max) {
  const str = String(s == null ? '' : s);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code !== 127) out += str.charAt(i);
  }
  return out.trim().slice(0, max);
}
