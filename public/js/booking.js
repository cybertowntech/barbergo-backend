/* ============================================================
   BOOKING PAGE — MULTI-STEP FORM LOGIC
   ============================================================ */
(function () {
  const state = {
    step: 1,
    services: [],
    addons: [],
    selectedService: null,
    selectedAddons: [],
    cleanupOption: 'self',
    locationId: null,
    barberId: null,
    barberName: null,
    bookingDate: '',
    bookingTime: '',
    address: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    voucherCode: '',
    voucherDiscount: 0,
    voucherId: null,
    paymentMethod: 'toyyibpay',
    qrImageUrl: '',
  };

  // ---------- PRICE HELPERS ----------
  const CLEANUP_FEE = 5;
  function calcTotal() {
    let total = state.selectedService ? Number(state.selectedService.price) : 0;
    state.selectedAddons.forEach(a => total += Number(a.price));
    if (state.cleanupOption === 'barber') total += CLEANUP_FEE;
    return total;
  }
  function calcFinal() {
    return Math.max(calcTotal() - state.voucherDiscount, 0);
  }

  // ---------- STEP NAVIGATION ----------
  function goStep(n) {
    if (!validateStep(state.step)) return;
    document.querySelectorAll('.booking-step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 < n) s.classList.add('done');
      if (i + 1 === n) s.classList.add('active');
    });
    document.getElementById('step' + n).classList.add('active');
    state.step = n;
    updateSummary();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateStep(step) {
    if (step === 1) {
      if (!state.selectedService) { alert('Sila pilih gaya rambut.'); return false; }
    }
    if (step === 2) {
      if (!state.locationId) { alert('Sila pilih kawasan anda.'); return false; }
    }
    if (step === 3) {
      if (!state.bookingDate) { alert('Sila pilih tarikh.'); return false; }
      if (!state.bookingTime) { alert('Sila pilih masa.'); return false; }
      if (!state.address.trim()) { alert('Sila masukkan alamat.'); return false; }
      if (!state.customerName.trim()) { alert('Sila masukkan nama anda.'); return false; }
      if (!state.customerPhone.trim()) { alert('Sila masukkan nombor telefon.'); return false; }
    }
    return true;
  }

  // ---------- RENDER SERVICES ----------
  function renderServices(filter) {
    const list = document.getElementById('serviceList');
    const filtered = filter === 'all'
      ? state.services
      : state.services.filter(s => s.category === filter);

    list.innerHTML = filtered.map(s => `
      <div class="option-item${state.selectedService && state.selectedService.id === s.id ? ' selected' : ''}"
           data-id="${s.id}">
        <span class="option-name">${s.name}</span>
        <span class="option-price">RM${Number(s.price).toFixed(0)}</span>
      </div>
    `).join('');

    list.querySelectorAll('.option-item').forEach(el => {
      el.addEventListener('click', () => {
        const svc = state.services.find(s => String(s.id) === el.dataset.id);
        state.selectedService = svc;
        renderServices(filter);
        updateSummary();
      });
    });
  }

  function renderAddons() {
    const list = document.getElementById('addonList');
    list.innerHTML = state.addons.map(a => `
      <div class="option-item${state.selectedAddons.find(x => x.id === a.id) ? ' selected addon-selected' : ''}"
           data-id="${a.id}">
        <span class="option-name">${a.name}</span>
        <span class="option-price">+RM${Number(a.price).toFixed(0)}</span>
      </div>
    `).join('');

    list.querySelectorAll('.option-item').forEach(el => {
      el.addEventListener('click', () => {
        const addon = state.addons.find(a => String(a.id) === el.dataset.id);
        const idx = state.selectedAddons.findIndex(x => x.id === addon.id);
        if (idx >= 0) state.selectedAddons.splice(idx, 1);
        else state.selectedAddons.push(addon);
        renderAddons();
        updateSummary();
      });
    });
  }

  // ---------- RENDER BARBERS ----------
  async function loadBarbers(locationId) {
    const list = document.getElementById('barberList');
    list.innerHTML = '<p class="muted">Mencari barber...</p>';
    try {
      const barbers = await API.booking.getAvailableBarbers ? API.booking.getAvailableBarbers(locationId) : fetch(`/api/booking/available-barbers?locationId=${locationId}`).then(r => r.json());
      const data = await barbers;
      if (!data.length) { list.innerHTML = '<p class="muted">Tiada barber tersedia buat masa ini.</p>'; return; }
      list.innerHTML = data.map(b => `
        <div class="barber-item${state.barberId === b.id ? ' selected' : ''}" data-id="${b.id}" data-name="${b.name}">
          <div class="barber-avatar">${b.name.charAt(0).toUpperCase()}</div>
          <div class="barber-info">
            <h4>${b.name}</h4>
            <p class="muted">${b.specialty || 'General Barber'} · ${b.location_name || ''}</p>
          </div>
          <span class="barber-rating">⭐ ${Number(b.rating).toFixed(1)}</span>
        </div>
      `).join('');

      list.querySelectorAll('.barber-item').forEach(el => {
        el.addEventListener('click', () => {
          state.barberId = el.dataset.id;
          state.barberName = el.dataset.name;
          list.querySelectorAll('.barber-item').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
          updateSummary();
        });
      });
    } catch {
      list.innerHTML = '<p class="muted">Gagal memuatkan barber.</p>';
    }
  }

  // ---------- VOUCHER ----------
  async function applyVoucher() {
    const code = document.getElementById('voucherCode').value.trim().toUpperCase();
    const msg = document.getElementById('voucherMsg');
    if (!code) return;
    try {
      const res = await API.booking.applyVoucher(code);
      state.voucherCode = code;
      state.voucherDiscount = Number(res.discount);
      msg.textContent = `✓ ${res.description || 'Voucher digunakan'} — RM${res.discount} diskaun`;
      msg.className = 'voucher-msg success';
      updateSummary();
    } catch (err) {
      state.voucherCode = '';
      state.voucherDiscount = 0;
      msg.textContent = err.message;
      msg.className = 'voucher-msg error';
      updateSummary();
    }
  }

  // ---------- PAYMENT OPTIONS ----------
  async function loadPaymentOptions() {
    try {
      const opts = await fetch('/api/payment/options').then(r => r.json());
      if (opts.qr && opts.qr.imageUrl) {
        state.qrImageUrl = opts.qr.imageUrl;
        const qrEl = document.getElementById('qrOption');
        if (qrEl) qrEl.style.display = '';
      }
    } catch {}
  }

  function handlePaymentChange() {
    document.querySelectorAll('[name="payment"]').forEach(r => {
      r.addEventListener('change', () => {
        state.paymentMethod = r.value;
        const qrDisplay = document.getElementById('qrDisplay');
        if (r.value === 'qr' && r.checked && state.qrImageUrl) {
          qrDisplay.style.display = '';
          qrDisplay.innerHTML = `
            <p class="muted" style="margin-bottom:0.8rem">Imbas QR untuk bayar, kemudian klik sahkan.</p>
            <img src="${state.qrImageUrl}" alt="QR Payment">
          `;
        } else {
          qrDisplay.style.display = 'none';
        }
      });
    });
  }

  // ---------- SUMMARY ----------
  function updateSummary() {
    const content = document.getElementById('summaryContent');
    const totalEl = document.getElementById('summaryTotal');
    if (!state.selectedService) {
      content.innerHTML = '<p class="muted">Pilih gaya rambut untuk mula.</p>';
      totalEl.textContent = 'RM0';
      return;
    }
    let rows = `<div class="summary-row"><span>${state.selectedService.name}</span><span>RM${Number(state.selectedService.price).toFixed(0)}</span></div>`;
    state.selectedAddons.forEach(a => {
      rows += `<div class="summary-row muted"><span>${a.name}</span><span>+RM${Number(a.price).toFixed(0)}</span></div>`;
    });
    if (state.cleanupOption === 'barber') {
      rows += `<div class="summary-row muted"><span>Barber Kemas</span><span>+RM5</span></div>`;
    }
    if (state.voucherDiscount > 0) {
      rows += `<div class="summary-row discount"><span>Voucher ${state.voucherCode}</span><span>-RM${state.voucherDiscount.toFixed(0)}</span></div>`;
    }
    if (state.barberName) {
      rows += `<div class="summary-row muted"><span>Barber</span><span>${state.barberName}</span></div>`;
    }
    if (state.bookingDate && state.bookingTime) {
      rows += `<div class="summary-row muted"><span>Jadual</span><span>${state.bookingDate} ${state.bookingTime}</span></div>`;
    }
    content.innerHTML = rows;
    totalEl.textContent = `RM${calcFinal().toFixed(0)}`;
  }

  // ---------- SUBMIT BOOKING ----------
  async function confirmBooking() {
    const btn = document.getElementById('confirmBookingBtn');
    btn.textContent = 'Memproses...';
    btn.disabled = true;

    // read latest form values
    state.bookingDate = document.getElementById('bookingDate').value;
    state.bookingTime = document.getElementById('bookingTime').value;
    state.address = document.getElementById('bookingAddress').value;
    state.customerName = document.getElementById('customerName').value;
    state.customerPhone = document.getElementById('customerPhone').value;
    state.customerEmail = document.getElementById('customerEmail').value;
    state.paymentMethod = document.querySelector('[name="payment"]:checked').value;

    try {
      const res = await API.booking.create({
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        customerEmail: state.customerEmail,
        address: state.address,
        locationId: state.locationId,
        barberId: state.barberId,
        serviceId: state.selectedService.id,
        addonIds: state.selectedAddons.map(a => a.id),
        cleanupOption: state.cleanupOption,
        voucherCode: state.voucherCode || undefined,
        bookingDate: state.bookingDate,
        bookingTime: state.bookingTime,
        paymentMethod: state.paymentMethod
      });

      localStorage.removeItem('bg_cart');

      if (state.paymentMethod === 'toyyibpay') {
        const billRes = await fetch('/api/payment/toyyibpay/create-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: res.bookingId })
        }).then(r => r.json());

        if (billRes.paymentUrl) {
          window.location.href = billRes.paymentUrl;
          return;
        }
      }

      window.location.href = `/booking-confirmation.html?id=${res.bookingId}`;
    } catch (err) {
      btn.textContent = 'Sahkan Tempahan';
      btn.disabled = false;
      alert('Ralat: ' + err.message);
    }
  }

  // ---------- RESTORE FROM CART ----------
  function restoreFromCart() {
    const cart = JSON.parse(localStorage.getItem('bg_cart') || '{}');
    if (cart.service) {
      state.selectedService = cart.service;
      state.selectedAddons = cart.addons || [];
    }
  }

  // ---------- SET MIN DATE ----------
  function setMinDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) dateInput.min = today;
  }

  // ---------- INIT ----------
  async function init() {
    restoreFromCart();

    const loader = document.getElementById('loader');
    if (loader) gsap && gsap.to(loader, { yPercent: -100, delay: 0.6, duration: 0.7, ease: 'power4.inOut', onComplete: () => loader.style.display = 'none' });

    try {
      const allSvc = await API.services.list();
      state.services = allSvc.filter(s => s.type === 'haircut');
      state.addons = allSvc.filter(s => s.type === 'addon');
    } catch { state.services = []; state.addons = []; }

    renderServices('all');
    renderAddons();
    setMinDate();
    await loadPaymentOptions();
    handlePaymentChange();
    updateSummary();

    // Step filter buttons
    document.querySelectorAll('.step-filter .filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.step-filter .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderServices(tab.dataset.cat);
      });
    });

    // Cleanup
    document.querySelectorAll('[name="cleanup"]').forEach(r => {
      r.addEventListener('change', () => { state.cleanupOption = r.value; updateSummary(); });
    });

    // Location select
    try {
      const locs = await API.locations.list();
      const sel = document.getElementById('locationSelect');
      locs.forEach(l => sel.innerHTML += `<option value="${l.id}">${l.name}</option>`);
      sel.addEventListener('change', () => {
        state.locationId = sel.value || null;
        if (state.locationId) loadBarbers(state.locationId);
      });
    } catch {}

    // Form inputs
    ['bookingDate', 'bookingTime', 'bookingAddress', 'customerName', 'customerPhone', 'customerEmail'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        const key = id === 'bookingAddress' ? 'address' : id.replace('booking', '').replace('customer', 'customer');
        const stateKey = {
          bookingDate: 'bookingDate', bookingTime: 'bookingTime', bookingAddress: 'address',
          customerName: 'customerName', customerPhone: 'customerPhone', customerEmail: 'customerEmail'
        }[id];
        state[stateKey] = el.value;
        updateSummary();
      });
    });

    // Next/prev buttons
    document.querySelectorAll('.next-step').forEach(btn => {
      btn.addEventListener('click', () => goStep(parseInt(btn.dataset.next)));
    });
    document.querySelectorAll('.prev-step').forEach(btn => {
      btn.addEventListener('click', () => goStep(parseInt(btn.dataset.prev)));
    });

    // Voucher
    document.getElementById('applyVoucherBtn').addEventListener('click', applyVoucher);
    document.getElementById('voucherCode').addEventListener('keydown', e => { if (e.key === 'Enter') applyVoucher(); });

    // Confirm
    document.getElementById('confirmBookingBtn').addEventListener('click', confirmBooking);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
