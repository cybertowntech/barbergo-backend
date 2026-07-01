const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase } = require('../db');

function requireBarber(req, res, next) {
  if (!req.session.barberId) return res.status(401).json({ error: 'Sila log masuk' });
  next();
}

// ---------- AUTH ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: barber, error } = await supabase
    .from('barbers').select('*').eq('email', email).eq('active', true).single();

  if (error || !barber) return res.status(401).json({ error: 'Email atau kata laluan salah' });
  if (!bcrypt.compareSync(password, barber.password)) {
    return res.status(401).json({ error: 'Email atau kata laluan salah' });
  }
  req.session.barberId = barber.id;
  res.json({ id: barber.id, name: barber.name });
});

router.post('/logout', (req, res) => {
  req.session.barberId = null;
  res.json({ success: true });
});

router.get('/me', requireBarber, async (req, res) => {
  const { data, error } = await supabase
    .from('barbers')
    .select('id, name, email, phone, photo_url, specialty, status, rating, total_jobs, location_id, locations(name)')
    .eq('id', req.session.barberId)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, location_name: data.locations ? data.locations.name : null });
});

// ---------- LOCATION ----------
router.put('/location', requireBarber, async (req, res) => {
  const { locationId } = req.body;
  const { error } = await supabase.from('barbers').update({ location_id: locationId }).eq('id', req.session.barberId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ---------- STATUS ----------
router.put('/status', requireBarber, async (req, res) => {
  const { status } = req.body;
  if (!['available', 'busy', 'offline'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak sah' });
  }
  const { error } = await supabase.from('barbers').update({ status }).eq('id', req.session.barberId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ---------- AVAILABILITY ----------
router.post('/availability', requireBarber, async (req, res) => {
  const { schedule } = req.body;
  if (!Array.isArray(schedule)) return res.status(400).json({ error: 'Format tidak sah' });

  await supabase.from('barber_availability').delete().eq('barber_id', req.session.barberId);

  const rows = schedule.map(s => ({
    barber_id: req.session.barberId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    is_off: !!s.is_off
  }));
  const { error } = await supabase.from('barber_availability').insert(rows);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.get('/availability', requireBarber, async (req, res) => {
  const { data, error } = await supabase
    .from('barber_availability').select('*').eq('barber_id', req.session.barberId).order('day_of_week');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---------- JOBS ----------
router.get('/jobs', requireBarber, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, services(name), customers(name, phone)')
    .eq('barber_id', req.session.barberId)
    .order('booking_date', { ascending: false })
    .order('booking_time', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  const result = data.map(b => ({
    ...b,
    service_name: b.services ? b.services.name : null,
    customer_name: b.customers ? b.customers.name : null,
    customer_phone: b.customers ? b.customers.phone : null,
  }));
  res.json(result);
});

const VALID_STATUSES = ['pending', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled'];
const REQUIRED_CHECKLIST = ['sheet_removed', 'floor_cleaned', 'hair_bagged', 'chair_wiped', 'area_clean'];

router.put('/jobs/:id', requireBarber, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Status tidak sah' });

  const { data: booking, error: findErr } = await supabase
    .from('bookings').select('*').eq('id', req.params.id).eq('barber_id', req.session.barberId).single();

  if (findErr || !booking) return res.status(404).json({ error: 'Job tidak dijumpai' });

  if (status === 'completed' && booking.cleanup_option === 'barber') {
    const checklist = booking.cleanup_checklist || {};
    const allDone = REQUIRED_CHECKLIST.every(k => checklist[k] === true);
    if (!allDone) {
      return res.status(400).json({ error: 'Sila lengkapkan checklist kemas sebelum tamatkan job' });
    }
  }

  const { error } = await supabase.from('bookings').update({ status }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  if (status === 'completed') {
    const { data: b } = await supabase.from('barbers').select('total_jobs').eq('id', req.session.barberId).single();
    if (b) await supabase.from('barbers').update({ total_jobs: b.total_jobs + 1 }).eq('id', req.session.barberId);
  }

  res.json({ success: true });
});

router.put('/jobs/:id/cleanup', requireBarber, async (req, res) => {
  const { checklist } = req.body;
  const { error } = await supabase
    .from('bookings').update({ cleanup_checklist: checklist })
    .eq('id', req.params.id).eq('barber_id', req.session.barberId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ---------- EARNINGS ----------
router.get('/earnings', requireBarber, async (req, res) => {
  const barberId = req.session.barberId;

  const { data: jobs, error } = await supabase
    .from('bookings').select('*').eq('barber_id', barberId).eq('status', 'completed')
    .order('booking_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const { data: payouts } = await supabase
    .from('payouts').select('*').eq('barber_id', barberId).order('week_start', { ascending: false });

  const totalEarned = jobs.reduce((sum, j) => sum + Number(j.barber_earning), 0);
  const totalPaid = (payouts || []).filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.total_amount), 0);
  const pending = totalEarned - totalPaid;

  res.json({
    jobs, payouts: payouts || [],
    summary: {
      totalJobs: jobs.length,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      pending: Math.round(pending * 100) / 100
    }
  });
});

// ---------- CUSTOMERS ----------
router.get('/customers', requireBarber, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('booking_date, customers(id, name, phone)')
    .eq('barber_id', req.session.barberId)
    .eq('status', 'completed');

  if (error) return res.status(500).json({ error: error.message });

  const map = new Map();
  data.forEach(b => {
    if (!b.customers) return;
    const c = b.customers;
    if (!map.has(c.id)) map.set(c.id, { id: c.id, name: c.name, phone: c.phone, visit_count: 0, last_visit: b.booking_date });
    const entry = map.get(c.id);
    entry.visit_count++;
    if (b.booking_date > entry.last_visit) entry.last_visit = b.booking_date;
  });

  const result = Array.from(map.values()).sort((a, b) => b.last_visit.localeCompare(a.last_visit));
  res.json(result);
});

module.exports = router;
