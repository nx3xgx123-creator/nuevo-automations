import { cors, redis, redisPipeline, CONFIGURED, clean, dubaiToday } from '../_lib.js';

// Admin view of bookings. Protected by ADMIN_KEY because this is the only
// endpoint that exposes customer names and phone numbers.
//
//   GET /api/admin?key=SECRET                 -> upcoming bookings
//   GET /api/admin?key=SECRET&del=DATE:TIME   -> cancel one slot
export default async function handler(req, res) {
  if (cors(req, res)) return;

  const expected = process.env.ADMIN_KEY || '';
  if (!expected) return res.status(503).json({ ok: false, error: 'admin_key_not_set' });

  const given = clean(req.query.key, 128);
  // Compare every character rather than bailing on first mismatch.
  let same = given.length === expected.length;
  for (let i = 0; i < expected.length; i++) {
    if (given.charCodeAt(i) !== expected.charCodeAt(i)) same = false;
  }
  if (!same) return res.status(401).json({ ok: false, error: 'unauthorised' });

  if (!CONFIGURED) return res.status(503).json({ ok: false, error: 'not_configured' });

  try {
    // Cancellation: ?del=2026-09-06:14:00
    const del = clean(req.query.del, 20);
    if (del) {
      const m = del.match(/^(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})$/);
      if (!m) return res.status(400).json({ ok: false, error: 'bad_del_format', expected: 'YYYY-MM-DD:HH:MM' });
      const removed = await redis(['HDEL', 'booking:' + m[1], m[2]]);
      return res.status(200).json({ ok: true, deleted: removed === 1, date: m[1], time: m[2] });
    }

    // Upcoming bookings, read from the source of truth rather than the
    // append-only log so cancellations are reflected.
    const today = dubaiToday();
    const base = new Date(Date.UTC(
      Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10))
    ));
    const dates = [];
    for (let i = 0; i < 45; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const results = await redisPipeline(dates.map(function (d) { return ['HGETALL', 'booking:' + d]; }));

    const bookings = [];
    dates.forEach(function (d, i) {
      const entry = Array.isArray(results) ? results[i] : null;
      const flat = entry && entry.result ? entry.result : null;
      if (!flat || !flat.length) return;
      // Upstash returns HGETALL as a flat [field, value, field, value, ...] array
      for (let k = 0; k < flat.length; k += 2) {
        let details = {};
        try { details = JSON.parse(flat[k + 1]); } catch (e) { details = { raw: flat[k + 1] }; }
        bookings.push(Object.assign({ date: d, time: flat[k] }, details));
      }
    });

    bookings.sort(function (a, b) {
      return (a.date + a.time).localeCompare(b.date + b.time);
    });

    return res.status(200).json({ ok: true, count: bookings.length, bookings: bookings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
