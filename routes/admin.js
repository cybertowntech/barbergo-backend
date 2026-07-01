const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase } = require('../db');

function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'Sila log masuk' });
  next();
}

// ---------- AUTH ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: admin, error } = await supabase.from('admins').select('*').eq('email', email).single();
  if (error || !admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Email atau kata laluan salah' });
  }
  req.session.adminId = admin.id;
  res.json({ id: admin.id, name: admin.name });
});

router.post('/logout', (req, res) => {
  req.session.adminId = null;
  res.json({ success: true });
});

router.get('/me', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('admins').select('id, email, name').eq('id', req.session.adminId).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ---------- DASHBOARD OVERVIEW ----------
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    const [todayCompleted, monthCompleted, pendingCount, activeBarbersData, totalBarbersData, recentBookings] = await Promise.all([
      supabase.from('bookings').select('final_price').eq('booking_date', today).eq('status', 'completed'),
      supabase.from('bookings').select('final_price, owner_earning').gte('booking_date', monthStart).eq('status', 'completed'),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirmed', 'on_the_way', 'arrived', 'in_progress']),
      supabase.from('barbers').select('id', { count: 'exact', head: true }).eq('active', true).neq('status', 'offline'),
      supabase.from('barbers').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('bookings')
        .select('id, status, booking_date, booking_time, final_price, services(name), customers(name), barbers(name)')
        .order('created_at', { ascending: false }).limit(10)
    ]);

    const todayRevenue = (todayCompleted.data || []).reduce((s, b) => s + Number(b.final_price), 0);
    const monthRevenue = (monthCompleted.data || []).reduce((s, b) => s + Number(b.final_price), 0);
    const monthOwnerEarning = (monthCompleted.data || []).reduce((s, b) => s + Number(b.owner_earning), 0);

    res.json({
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      monthRevenue: Math.round(monthRevenue * 100) / 100,
      monthOwnerEarning: Math.round(monthOwnerEarning * 100) / 100,
      pendingJobs: pendingCount.count || 0,
      completedToday: (todayCompleted.data || []).length,
      activeBarbers: activeBarbersData.count || 0,
      totalBarbers: totalBarbersData.count || 0,
      recentBookings: (recentBookings.data || []).map(b => ({
        id: b.id, status: b.status, booking_date: b.booking_date, booking_time: b.booking_time,
        final_price: b.final_price,
        service_name: b.services ? b.services.name : null,
        customer_name: b.customers ? b.customers.name : null,
        barber_name: b.barbers ? b.barbers.name : null,
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- BARBER MANAGEMENT ----------
router.get('/barbers', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('barbers').select('*, locations(name)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const result = data.map(b => {
    const { password, locations, ...rest } = b;
    return { ...rest, location_name: locations ? locations.name : null };
  });
  res.json(result);
});

router.post('/barbers', requireAdmin, async (req, res) => {
  const { name, phone, email, password, photoUrl, specialty, locationId } = req.body;
  if (!name || !phone || !email || !password) return res.status(400).json({ error: 'Maklumat tidak lengkap' });
  const hash = bcrypt.hashSync(password, 10);

  const { data, error } = await supabase
    .from('barbers')
    .insert({ name, phone, email, password: hash, photo_url: photoUrl || null, specialty: specialty || null, location_id: locationId || null })
    .select().single();

  if (error) {
    const msg = error.message.includes('duplicate') ? 'Email telah digunakan' : error.message;
    return res.status(500).json({ error: msg });
  }
  res.json({ id: data.id });
});

router.get('/barbers/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;

  const { data: barber, error: bErr } = await supabase
    .from('barbers').select('*, locations(name)').eq('id', id).single();
  if (bErr || !barber) return res.status(404).json({ error: 'Barber tidak dijumpai' });
  delete barber.password;

  const { data: jobs } = await supabase
    .from('bookings')
    .select('*, services(name), customers(name, phone)')
    .eq('barber_id', id)
    .order('booking_date', { ascending: false });

  const jobsFormatted = (jobs || []).map(j => ({
    ...j,
    service_name: j.services ? j.services.name : null,
    customer_name: j.customers ? j.customers.name : null,
    customer_phone: j.customers ? j.customers.phone : null,
  }));

  const completedJobs = jobsFormatted.filter(j => j.status === 'completed');

  // Unique customers from completed jobs
  const custMap = new Map();
  completedJobs.forEach(j => {
    if (!j.customer_name) return;
    const key = j.customer_phone;
    if (!custMap.has(key)) custMap.set(key, { name: j.customer_name, phone: j.customer_phone, visit_count: 0, last_visit: j.booking_date });
    const entry = custMap.get(key);
    entry.visit_count++;
    if (j.booking_date > entry.last_visit) entry.last_visit = j.booking_date;
  });
  const customers = Array.from(custMap.values()).sort((a, b) => b.last_visit.localeCompare(a.last_visit));

  const { data: payouts } = await supabase
    .from('payouts').select('*').eq('barber_id', id).order('week_start', { ascending: false });

  const totalEarned = completedJobs.reduce((s, j) => s + Number(j.barber_earning), 0);
  const reviews = completedJobs.filter(j => j.review).map(j => ({
    rating: j.rating, review: j.review, customer: j.customer_name, date: j.booking_date
  }));

  res.json({
    barber: { ...barber, location_name: barber.locations ? barber.locations.name : null },
    jobs: jobsFormatted,
    customers,
    payouts: payouts || [],
    reviews,
    stats: {
      totalJobs: completedJobs.length,
      totalEarned: Math.round(totalEarned * 100) / 100,
      uniqueCustomers: customers.length,
      avgRating: barber.rating
    }
  });
});

router.put('/barbers/:id', requireAdmin, async (req, res) => {
  const { name, phone, specialty, locationId, active, status } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (specialty !== undefined) updates.specialty = specialty;
  if (locationId !== undefined) updates.location_id = locationId;
  if (active !== undefined) updates.active = active;
  if (status !== undefined) updates.status = status;

  const { error } = await supabase.from('barbers').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ---------- BOOKINGS MANAGEMENT ----------
router.get('/bookings', requireAdmin, async (req, res) => {
  const { status } = req.query;
  let query = supabase
    .from('bookings')
    .select('*, services(name), customers(name, phone), barbers(name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const result = data.map(b => ({
    ...b,
    service_name: b.services ? b.services.name : null,
    customer_name: b.customers ? b.customers.name : null,
    customer_phone: b.customers ? b.customers.phone : null,
    barber_name: b.barbers ? b.barbers.name : null,
  }));
  res.json(result);
});

router.put('/bookings/:id', requireAdmin, async (req, res) => {
  const { barberId, status, paymentStatus } = req.body;
  const updates = {};
  if (barberId !== undefined) updates.barber_id = barberId;
  if (status !== undefined) updates.status = status;
  if (paymentStatus !== undefined) updates.payment_status = paymentStatus;

  const { error } = await supabase.from('bookings').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ---------- PAYOUTS ----------
router.get('/payouts', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('payouts').select('*, barbers(name)').order('week_start', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(p => ({ ...p, barber_name: p.barbers ? p.barbers.name : null })));
});

router.post('/payouts/generate', requireAdmin, async (req, res) => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = sunday.toISOString().slice(0, 10);

  const { data: completedJobs, error } = await supabase
    .from('bookings')
    .select('barber_id, barber_earning')
    .eq('status', 'completed')
    .gte('booking_date', weekStart)
    .lte('booking_date', weekEnd);

  if (error) return res.status(500).json({ error: error.message });
  if (!completedJobs.length) return res.json({ created: 0 });

  const grouped = {};
  completedJobs.forEach(j => {
    if (!j.barber_id) return;
    if (!grouped[j.barber_id]) grouped[j.barber_id] = { jobs: 0, total: 0 };
    grouped[j.barber_id].jobs++;
    grouped[j.barber_id].total += Number(j.barber_earning);
  });

  let created = 0;
  for (const barberId of Object.keys(grouped)) {
    const { data: existing } = await supabase
      .from('payouts').select('id').eq('barber_id', barberId).eq('week_start', weekStart).single();

    if (!existing) {
      await supabase.from('payouts').insert({
        barber_id: barberId, week_start: weekStart, week_end: weekEnd,
        total_jobs: grouped[barberId].jobs, total_amount: grouped[barberId].total, status: 'unpaid'
      });
      created++;
    }
  }
  res.json({ created });
});

router.put('/payouts/:id/paid', requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ---------- VOUCHERS ----------
router.get('/vouchers', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/vouchers', requireAdmin, async (req, res) => {
  const { code, discountAmount, description, maxUses, expiresAt } = req.body;
  if (!code || !discountAmount) return res.status(400).json({ error: 'Kod & diskaun diperlukan' });

  const { data, error } = await supabase
    .from('vouchers')
    .insert({
      code: code.toUpperCase(), discount_amount: discountAmount, description: description || null,
      max_uses: maxUses || null, expires_at: expiresAt || null
    })
    .select().single();

  if (error) {
    const msg = error.message.includes('duplicate') ? 'Kod voucher sudah wujud' : error.message;
    return res.status(500).json({ error: msg });
  }
  res.json({ id: data.id });
});

router.put('/vouchers/:id', requireAdmin, async (req, res) => {
  const { active, discountAmount, maxUses } = req.body;
  const updates = {};
  if (active !== undefined) updates.active = active;
  if (discountAmount !== undefined) updates.discount_amount = discountAmount;
  if (maxUses !== undefined) updates.max_uses = maxUses;

  const { error } = await supabase.from('vouchers').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.get('/vouchers-report', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('voucher_discount, vouchers(code)')
    .eq('status', 'completed')
    .not('voucher_id', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const grouped = {};
  data.forEach(b => {
    const code = b.vouchers ? b.vouchers.code : 'Unknown';
    if (!grouped[code]) grouped[code] = { code, uses: 0, total_cost: 0 };
    grouped[code].uses++;
    grouped[code].total_cost += Number(b.voucher_discount);
  });

  res.json(Object.values(grouped));
});

// ---------- SETTINGS ----------
router.get('/settings', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) return res.status(500).json({ error: error.message });
  const settings = {};
  data.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

router.put('/settings', requireAdmin, async (req, res) => {
  const updates = req.body;
  const keys = Object.keys(updates);
  if (!keys.length) return res.json({ success: true });

  const rows = keys.map(key => ({ key, value: String(updates[key]) }));
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
