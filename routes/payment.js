const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const { supabase, getSetting } = require('../db');

// Store upload in memory, then push to Supabase Storage (works on any host, no local disk dependency)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ---------- Public: get payment options available ----------
router.get('/options', async (req, res) => {
  const qrImageUrl = await getSetting('qr_image_url');
  const qrDetails = await getSetting('qr_details');
  res.json({
    toyyibpay: true,
    qr: { imageUrl: qrImageUrl, details: qrDetails },
    cash: true
  });
});

// ---------- Admin: upload QR image to Supabase Storage ----------
router.post('/qr-upload', upload.single('qr'), async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'Tiada fail dimuat naik' });

  const filename = `qr-${Date.now()}.${req.file.originalname.split('.').pop()}`;

  const { error: uploadError } = await supabase.storage
    .from('public-assets')
    .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

  if (uploadError) return res.status(500).json({ error: 'Gagal muat naik: ' + uploadError.message });

  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(filename);
  const publicUrl = urlData.publicUrl;

  await supabase.from('settings').upsert({ key: 'qr_image_url', value: publicUrl }, { onConflict: 'key' });
  res.json({ url: publicUrl });
});

// ---------- ToyyibPay: create bill ----------
router.post('/toyyibpay/create-bill', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Booking ID diperlukan' });

    const secretKey = await getSetting('toyyibpay_secret_key');
    const categoryCode = await getSetting('toyyibpay_category_code');
    const mode = await getSetting('toyyibpay_mode');

    if (!secretKey || !categoryCode) {
      return res.status(400).json({ error: 'ToyyibPay belum dikonfigurasi. Sila hubungi admin.' });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, customers(name, email, phone), services(name)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) return res.status(404).json({ error: 'Booking tidak dijumpai' });

    const baseUrl = mode === 'production' ? 'https://toyyibpay.com' : 'https://dev.toyyibpay.com';
    const protocol = req.protocol;
    const host = req.get('host');

    const billData = {
      userSecretKey: secretKey,
      categoryCode: categoryCode,
      billName: `BarberGo - ${booking.services.name}`.slice(0, 30),
      billDescription: `Booking #${booking.id} - ${booking.services.name}`.slice(0, 100),
      billPriceSetting: 1,
      billPayorInfo: 1,
      billAmount: String(Math.round(Number(booking.final_price) * 100)),
      billReturnUrl: `${protocol}://${host}/booking-confirmation.html?id=${booking.id}`,
      billCallbackUrl: `${protocol}://${host}/api/payment/toyyibpay/callback`,
      billExternalReferenceNo: 'BG' + booking.id,
      billTo: booking.customers.name,
      billEmail: booking.customers.email || 'customer@barbergo.my',
      billPhone: booking.customers.phone,
      billSplitPayment: 0,
      billPaymentChannel: '2',
      billExpiryDays: '1'
    };

    const params = new URLSearchParams(billData);
    const response = await axios.post(`${baseUrl}/index.php/api/createBill`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const result = response.data;
    if (!Array.isArray(result) || !result[0] || !result[0].BillCode) {
      return res.status(500).json({ error: 'Gagal mencipta bil ToyyibPay', detail: result });
    }

    const billCode = result[0].BillCode;
    await supabase.from('bookings').update({ payment_method: 'toyyibpay' }).eq('id', bookingId);

    res.json({ billCode, paymentUrl: `${baseUrl}/${billCode}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- ToyyibPay: callback ----------
router.post('/toyyibpay/callback', async (req, res) => {
  const { status, order_id } = req.body;
  const bookingId = (order_id || '').replace('BG', '');
  if (!bookingId) return res.sendStatus(400);

  const paymentStatus = status === '1' ? 'paid' : (status === '3' ? 'failed' : 'pending');
  const updates = { payment_status: paymentStatus };
  if (paymentStatus === 'paid') updates.status = 'confirmed';

  const { error } = await supabase.from('bookings').update(updates).eq('id', bookingId);
  res.sendStatus(error ? 500 : 200);
});

// ---------- Mark cash/QR payment as received ----------
router.put('/:bookingId/mark-paid', async (req, res) => {
  if (!req.session.adminId && !req.session.barberId) return res.status(401).json({ error: 'Unauthorized' });

  const { data: booking } = await supabase.from('bookings').select('status').eq('id', req.params.bookingId).single();
  const updates = { payment_status: 'paid' };
  if (booking && booking.status === 'pending') updates.status = 'confirmed';

  const { error } = await supabase.from('bookings').update(updates).eq('id', req.params.bookingId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
