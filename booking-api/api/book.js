import { cors, redis, CONFIGURED, isValidDate, isValidTime, clean } from '../_lib.js';

// POST /api/book  { date, time, name, phone, business?, note? }
//
// The write is HSETNX: it sets the slot only if that field does not already
// exist, and reports whether it won. Two people submitting the same slot at
// the same moment cannot both succeed - Redis arbitrates, not the
// application, so there is no read-then-write race.
export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (!CONFIGURED) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const date = clean(body.date, 10);
    const time = clean(body.time, 5);
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 32);
    const business = clean(body.business, 80);
    const note = clean(body.note, 400);

    if (!isValidDate(date)) return res.status(400).json({ ok: false, error: 'bad_date' });
    if (!isValidTime(time)) return res.status(400).json({ ok: false, error: 'bad_time' });
    if (name.length < 2) return res.status(400).json({ ok: false, error: 'bad_name' });
    if (business.length < 2) return res.status(400).json({ ok: false, error: 'bad_business' });
    if (phone.replace(/\D/g, '').length < 7) return res.status(400).json({ ok: false, error: 'bad_phone' });

    const record = JSON.stringify({
      name: name, phone: phone, business: business, note: note,
      bookedAt: new Date().toISOString(),
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    });

    const won = await redis(['HSETNX', 'booking:' + date, time, record]);
    if (won !== 1) return res.status(409).json({ ok: false, error: 'slot_taken' });

    // Expire the day's hash well after the appointment so the store does not
    // grow forever, and keep a flat log for the admin view.
    await redis(['EXPIRE', 'booking:' + date, String(60 * 60 * 24 * 90)]);
    await redis(['LPUSH', 'booking:log', JSON.stringify({
      date: date, time: time, name: name, phone: phone, business: business,
      bookedAt: new Date().toISOString()
    })]);
    await redis(['LTRIM', 'booking:log', '0', '999']);

    return res.status(200).json({ ok: true, date: date, time: time });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error', message: String(err.message || err) });
  }
}
