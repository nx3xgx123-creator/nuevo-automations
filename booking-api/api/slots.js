import { cors, redisPipeline, CONFIGURED, dubaiToday } from '../_lib.js';

// GET /api/slots?days=14
// Which times are already taken, per date, so the front end can grey them out.
// Never returns customer details - only the booked times.
export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (!CONFIGURED) {
    return res.status(200).json({ ok: false, reason: 'not_configured', taken: {} });
  }

  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 30);
    const today = dubaiToday();
    const base = new Date(Date.UTC(
      Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10))
    ));

    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const results = await redisPipeline(dates.map(function (d) { return ['HKEYS', 'booking:' + d]; }));

    const taken = {};
    dates.forEach(function (d, i) {
      const entry = Array.isArray(results) ? results[i] : null;
      const times = entry && entry.result ? entry.result : [];
      if (times.length) taken[d] = times;
    });

    return res.status(200).json({ ok: true, today: today, taken: taken });
  } catch (err) {
    return res.status(200).json({ ok: false, reason: 'error', message: String(err.message || err), taken: {} });
  }
}
