const express = require('express');
const router = express.Router();
const { supabase, getSetting } = require('../db');

// Check & validate a voucher
router.post('/voucher-check', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Voucher code required' });

  const { data: voucher, error } = await supabase
    .from('vouchers').select('*').eq('code', code).eq('active', true).single();

  if (error || !voucher) return res.status(404).json({ error: 'Voucher tidak sah' });
  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Voucher telah tamat tempoh' });
  }
  if (voucher.max_uses && voucher.used_count >= voucher.max_uses) {
    return res.status(400).json({ error: 'Voucher telah mencapai had penggunaan' });
  }
  res.json({ valid: true, discount: voucher.discount_amount, description: voucher.description, voucherId: voucher.id });
});

// Find available barbers in a location
router.get('/available-barbers', async (req, res) => {
  const { locationId } = req.query;
  let query = supabase
    .from('barbers')
    .select('id, name, photo_url, specialty, rating, total_jobs, location_id, locations(name)')
    .eq('active', true)
    .eq('status', 'available')
    .order('rating', { ascending: false });

  if (locationId) query = query.eq('location_id', locationId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const result = data.map(b => ({
    id: b.id, name: b.name, photo_url: b.photo_url, specialty: b.specialty,
    rating: b.rating, total_jobs: b.total_jobs, location_name: b.locations ? b.locations.name : null
  }));
  res.json(result);
});

// Create a booking
router.post('/', async (req, res) => {
  try {
    const {
      customerName, customerPhone, customerEmail, address,
      locationId, barberId, serviceId, addonIds = [],
      cleanupOption = 'self', voucherCode,
      bookingDate, bookingTime, paymentMethod
    } = req.body;

    if (!customerName || !customerPhone || !address || !serviceId || !bookingDate || !bookingTime) {
      return res.status(400).json({ error: 'Maklumat tidak lengkap' });
    }

    // Get service price
    const { data: service, error: svcErr } = await supabase
      .from('services').select('*').eq('id', serviceId).single();
    if (svcErr || !service) return res.status(404).json({ error: 'Servis tidak dijumpai' });

    // Get addon prices
    let addonTotal = 0;
    if (addonIds.length) {
      const { data: addons } = await supabase.from('services').select('*').in('id', addonIds);
      addonTotal = (addons || []).reduce((sum, a) => sum + Number(a.price), 0);
    }

    const cleanupFee = parseFloat(await getSetting('cleanup_fee')) || 5;
    const cleanupBarberPct = parseFloat(await getSetting('cleanup_barber_pct')) || 80;
    const commissionBarberPct = parseFloat(await getSetting('commission_barber_pct')) || 70;
    const commissionOwnerPct = parseFloat(await getSetting('commission_owner_pct')) || 30;

    const cleanupCost = cleanupOption === 'barber' ? cleanupFee : 0;
    const servicePrice = Number(service.price);
    const originalPrice = servicePrice + addonTotal + cleanupCost;

    // Voucher — discount comes ONLY out of owner's share
    let voucherDiscount = 0;
    let voucherId = null;
    if (voucherCode) {
      const { data: voucher } = await supabase
        .from('vouchers').select('*').eq('code', voucherCode).eq('active', true).single();
      if (voucher) {
        voucherDiscount = Number(voucher.discount_amount);
        voucherId = voucher.id;
      }
    }
    const finalPrice = Math.max(originalPrice - voucherDiscount, 0);

    // Barber earning = 70% of (haircut+addon) + 80% of cleanup fee — UNAFFECTED by voucher
    const haircutAddonPortion = servicePrice + addonTotal;
    const barberEarning = (haircutAddonPortion * commissionBarberPct / 100) + (cleanupCost * cleanupBarberPct / 100);
    const ownerEarningGross = (haircutAddonPortion * commissionOwnerPct / 100) + (cleanupCost * (100 - cleanupBarberPct) / 100);
    const ownerEarning = ownerEarningGross - voucherDiscount;

    // Find or create customer
    const { data: existingCustomer } = await supabase
      .from('customers').select('*').eq('phone', customerPhone).single();

    let customerId;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabase.from('customers')
        .update({ name: customerName, address, location_id: locationId || null })
        .eq('id', customerId);
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({ name: customerName, phone: customerPhone, email: customerEmail || null, address, location_id: locationId || null })
        .select().single();
      if (custErr) throw custErr;
      customerId = newCustomer.id;
    }

    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerId,
        barber_id: barberId || null,
        location_id: locationId || null,
        service_id: serviceId,
        addon_ids: addonIds,
        cleanup_option: cleanupOption,
        voucher_id: voucherId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        address,
        original_price: originalPrice,
        voucher_discount: voucherDiscount,
        final_price: finalPrice,
        barber_earning: barberEarning,
        owner_earning: ownerEarning,
        payment_method: paymentMethod,
        payment_status: 'pending',
        status: 'pending'
      })
      .select().single();

    if (bookErr) throw bookErr;

    if (voucherId) {
      const { data: v } = await supabase.from('vouchers').select('used_count').eq('id', voucherId).single();
      if (v) {
        await supabase.from('vouchers').update({ used_count: v.used_count + 1 }).eq('id', voucherId);
      }
    }

    res.json({
      bookingId: booking.id,
      originalPrice,
      voucherDiscount,
      finalPrice,
      service: service.name,
      message: 'Tempahan berjaya dibuat'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Track a booking by id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`*, services(name), customers(name, phone), barbers(name, phone, photo_url), locations(name)`)
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Booking tidak dijumpai' });

  res.json({
    ...data,
    service_name: data.services ? data.services.name : null,
    customer_name: data.customers ? data.customers.name : null,
    customer_phone: data.customers ? data.customers.phone : null,
    barber_name: data.barbers ? data.barbers.name : null,
    barber_phone: data.barbers ? data.barbers.phone : null,
    barber_photo: data.barbers ? data.barbers.photo_url : null,
    location_name: data.locations ? data.locations.name : null,
  });
});

module.exports = router;
