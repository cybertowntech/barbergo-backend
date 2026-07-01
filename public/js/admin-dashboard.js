/* ============================================================
   ADMIN DASHBOARD LOGIC
   ============================================================ */
(function () {

  const STATUS_LABELS = {
    pending: 'Pending', confirmed: 'Disahkan', on_the_way: 'Dalam Perjalanan',
    arrived: 'Tiba', in_progress: 'Sedang Potong', completed: 'Selesai', cancelled: 'Dibatalkan'
  };

  // ---------- AUTH ----------
  async function checkAuth() {
    try {
      const me = await API.admin.me();
      document.getElementById('adminName').textContent = me.name || 'Admin';
    } catch {
      window.location.href = '/admin-login.html';
    }
  }

  // ---------- TABS ----------
  function initTabs() {
    document.querySelectorAll('.nav-item[data-tab]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const tab = link.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        const tabId = 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1);
        document.getElementById(tabId).classList.add('active');
        const loaders = { bookings: loadBookings, barbers: loadBarbers, payouts: loadPayouts, vouchers: loadVouchers, settings: loadSettings };
        if (loaders[tab]) loaders[tab]();
      });
    });
    document.getElementById('sidebarToggle') && document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  // ---------- OVERVIEW ----------
  async function loadOverview() {
    try {
      const d = await API.admin.dashboard();
      document.getElementById('todayRev').textContent = 'RM' + Number(d.todayRevenue).toFixed(2);
      document.getElementById('monthRev').textContent = 'RM' + Number(d.monthRevenue).toFixed(2);
      document.getElementById('monthOwner').textContent = 'RM' + Number(d.monthOwnerEarning).toFixed(2);
      document.getElementById('activeJobs').textContent = d.pendingJobs;
      document.getElementById('completedToday').textContent = d.completedToday;
      document.getElementById('activeBarbersVal').textContent = `${d.activeBarbers}/${d.totalBarbers}`;

      const tbody = document.getElementById('recentBody');
      if (!d.recentBookings.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:1.5rem">Tiada booking lagi.</td></tr>';
        return;
      }
      tbody.innerHTML = d.recentBookings.map(b => `
        <tr>
          <td><span style="font-family:var(--font-mono);font-size:0.8rem">#${b.id}</span></td>
          <td>${b.service_name || '—'}</td>
          <td>${b.customer_name || '—'}</td>
          <td>${b.barber_name || '<span class="muted">Belum assign</span>'}</td>
          <td style="font-family:var(--font-mono);font-size:0.8rem">${b.booking_date} ${b.booking_time}</td>
          <td><strong>RM${Number(b.final_price).toFixed(0)}</strong></td>
          <td><span class="status-pill status-${b.status}">${STATUS_LABELS[b.status] || b.status}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  // ---------- BARBERS ----------
  async function loadBarbers() {
    const list = document.getElementById('barbersList');
    list.innerHTML = '<p class="muted loading-msg">Memuatkan...</p>';
    try {
      const barbers = await API.admin.barbers.list();
      if (!barbers.length) { list.innerHTML = '<p class="muted">Tiada barber didaftarkan.</p>'; return; }
      list.innerHTML = barbers.map(b => `
        <div class="barber-row-card" data-id="${b.id}">
          <div class="user-avatar" style="background:var(--primary);color:#fff;font-size:1rem;flex-shrink:0">${b.name.charAt(0).toUpperCase()}</div>
          <div class="barber-row-info">
            <h4>${b.name}</h4>
            <p class="muted" style="font-size:0.83rem">${b.email} · ${b.location_name || 'Kawasan belum set'}</p>
          </div>
          <div style="display:flex;align-items:center;gap:0.8rem;flex-shrink:0">
            <span class="status-pill status-${b.status === 'available' ? 'confirmed' : b.status === 'offline' ? 'cancelled' : 'pending'}">${b.status}</span>
            <span style="font-family:var(--font-mono);font-size:0.82rem">⭐ ${Number(b.rating).toFixed(1)}</span>
            <span class="status-pill ${b.active ? 'status-completed' : 'status-cancelled'}">${b.active ? 'Aktif' : 'Suspend'}</span>
          </div>
          <svg style="color:var(--text-muted);flex-shrink:0" viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      `).join('');

      list.querySelectorAll('.barber-row-card').forEach(card => {
        card.addEventListener('click', () => viewBarberDetail(card.dataset.id));
      });
    } catch { list.innerHTML = '<p class="muted">Gagal memuatkan barber.</p>'; }
  }

  async function viewBarberDetail(id) {
    try {
      const d = await API.admin.barbers.detail(id);
      const b = d.barber;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.alignItems = 'flex-start';
      overlay.style.overflowY = 'auto';
      overlay.style.padding = '2rem 1rem';
      overlay.innerHTML = `
        <div class="modal-card" style="max-width:700px;width:100%">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem">
            <div>
              <h3 style="margin-bottom:0.2rem">${b.name}</h3>
              <p class="muted">${b.email} · ${b.phone}</p>
            </div>
            <button class="btn btn-ghost btn-sm close-detail">Tutup</button>
          </div>

          <!-- Stats -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.8rem;margin-bottom:1.5rem">
            <div class="stat-card"><span class="stat-label">Total Job</span><span class="stat-val" style="font-size:1.4rem">${d.stats.totalJobs}</span></div>
            <div class="stat-card"><span class="stat-label">Total Earned</span><span class="stat-val" style="font-size:1.4rem">RM${d.stats.totalEarned.toFixed(0)}</span></div>
            <div class="stat-card"><span class="stat-label">Customers</span><span class="stat-val" style="font-size:1.4rem">${d.stats.uniqueCustomers}</span></div>
            <div class="stat-card"><span class="stat-label">Rating</span><span class="stat-val" style="font-size:1.4rem">⭐${Number(d.stats.avgRating).toFixed(1)}</span></div>
          </div>

          <!-- Controls -->
          <div style="display:flex;gap:0.8rem;margin-bottom:1.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="toggleActiveBtn" data-id="${b.id}" data-active="${b.active}">
              ${b.active ? 'Suspend Barber' : 'Aktifkan Barber'}
            </button>
          </div>

          <!-- Recent Jobs -->
          <h4 style="font-family:var(--font-body);font-weight:700;margin-bottom:0.8rem">Job Terkini</h4>
          <div style="max-height:220px;overflow-y:auto;margin-bottom:1.5rem">
            ${d.jobs.slice(0,15).map(j => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 0;border-bottom:1px solid var(--divider);font-size:0.85rem">
                <div><strong>#${j.id} ${j.service_name}</strong><br><span class="muted">${j.customer_name} · ${j.booking_date}</span></div>
                <div style="text-align:right"><span class="status-pill status-${j.status}">${STATUS_LABELS[j.status] || j.status}</span><br><span style="font-family:var(--font-mono);font-weight:700">RM${Number(j.barber_earning).toFixed(0)}</span></div>
              </div>`).join('') || '<p class="muted">Tiada job lagi.</p>'}
          </div>

          <!-- Customers -->
          <h4 style="font-family:var(--font-body);font-weight:700;margin-bottom:0.8rem">Pelanggan (${d.customers.length})</h4>
          <div style="max-height:180px;overflow-y:auto;margin-bottom:1.5rem">
            ${d.customers.map(c => `
              <div style="display:flex;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--divider);font-size:0.85rem">
                <span>${c.name} · ${c.phone}</span>
                <span class="muted">${c.visit_count}x · Terakhir: ${c.last_visit}</span>
              </div>`).join('') || '<p class="muted">Tiada pelanggan lagi.</p>'}
          </div>

          <!-- Payouts -->
          <h4 style="font-family:var(--font-body);font-weight:700;margin-bottom:0.8rem">Rekod Pembayaran</h4>
          <div>
            ${d.payouts.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 0;border-bottom:1px solid var(--divider);font-size:0.85rem">
                <span>${p.week_start} — ${p.week_end} (${p.total_jobs} job)</span>
                <div style="display:flex;align-items:center;gap:0.8rem">
                  <strong>RM${Number(p.total_amount).toFixed(2)}</strong>
                  <span class="status-pill ${p.status === 'paid' ? 'status-completed' : 'status-pending'}">${p.status === 'paid' ? '✓ Dibayar' : 'Belum Bayar'}</span>
                  ${p.status !== 'paid' ? `<button class="btn btn-primary btn-sm pay-payout-btn" data-pid="${p.id}">Mark Paid</button>` : ''}
                </div>
              </div>`).join('') || '<p class="muted">Tiada rekod pembayaran lagi.</p>'}
          </div>
        </div>`;

      document.body.appendChild(overlay);
      overlay.querySelector('.close-detail').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

      overlay.querySelector('#toggleActiveBtn') && overlay.querySelector('#toggleActiveBtn').addEventListener('click', async btn => {
        const el = btn.currentTarget;
        const active = el.dataset.active === 'true';
        try {
          await API.admin.barbers.update(el.dataset.id, { active: !active });
          overlay.remove();
          loadBarbers();
        } catch (err) { alert(err.message); }
      });

      overlay.querySelectorAll('.pay-payout-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await API.admin.payouts.markPaid(btn.dataset.pid);
            overlay.remove();
            viewBarberDetail(id);
          } catch (err) { alert(err.message); }
        });
      });
    } catch (err) { alert('Gagal memuatkan detail: ' + err.message); }
  }

  // ---------- BOOKINGS ----------
  async function loadBookings() {
    const filter = document.getElementById('bookingStatusFilter').value;
    const tbody = document.getElementById('bookingsBody');
    tbody.innerHTML = '<tr><td colspan="8" class="muted" style="padding:1.5rem;text-align:center">Memuatkan...</td></tr>';
    try {
      const bookings = await API.admin.bookings.list(filter ? 'status=' + filter : '');
      if (!bookings.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="muted" style="padding:1.5rem;text-align:center">Tiada booking ditemui.</td></tr>';
        return;
      }
      tbody.innerHTML = bookings.map(b => `
        <tr>
          <td><span style="font-family:var(--font-mono);font-size:0.8rem">#${b.id}</span></td>
          <td>${b.service_name || '—'}</td>
          <td>${b.customer_name || '—'}<br><span class="muted" style="font-size:0.78rem">${b.customer_phone || ''}</span></td>
          <td>${b.barber_name || '<span class="muted">—</span>'}</td>
          <td style="font-family:var(--font-mono);font-size:0.78rem">${b.booking_date}<br>${b.booking_time}</td>
          <td><strong>RM${Number(b.final_price).toFixed(0)}</strong></td>
          <td><span class="status-pill ${b.payment_status === 'paid' ? 'status-completed' : 'status-pending'}">${b.payment_status}</span></td>
          <td><span class="status-pill status-${b.status}">${STATUS_LABELS[b.status] || b.status}</span></td>
        </tr>
      `).join('');
    } catch { tbody.innerHTML = '<tr><td colspan="8" class="muted" style="padding:1.5rem;text-align:center">Gagal memuatkan.</td></tr>'; }
  }

  // ---------- PAYOUTS ----------
  async function loadPayouts() {
    const list = document.getElementById('payoutsList');
    list.innerHTML = '<p class="muted loading-msg">Memuatkan...</p>';
    try {
      const payouts = await API.admin.payouts.list();
      if (!payouts.length) { list.innerHTML = '<p class="muted">Tiada rekod payout. Klik "Jana Payout" untuk jana minggu ini.</p>'; return; }
      list.innerHTML = payouts.map(p => `
        <div class="payout-row">
          <div>
            <strong>${p.barber_name}</strong>
            <p class="muted">${p.week_start} — ${p.week_end} · ${p.total_jobs} job</p>
          </div>
          <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem">
            <strong>RM${Number(p.total_amount).toFixed(2)}</strong>
            <span class="status-pill ${p.status === 'paid' ? 'status-completed' : 'status-unpaid'}">${p.status === 'paid' ? '✓ Dibayar' : 'Belum Bayar'}</span>
            ${p.status !== 'paid' ? `<button class="btn btn-primary btn-sm mark-paid-btn" data-id="${p.id}">Mark Paid</button>` : `<span class="muted" style="font-size:0.75rem">${p.paid_at ? p.paid_at.slice(0,10) : ''}</span>`}
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.mark-paid-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await API.admin.payouts.markPaid(btn.dataset.id);
            loadPayouts();
          } catch (err) { alert(err.message); }
        });
      });
    } catch { list.innerHTML = '<p class="muted">Gagal memuatkan payout.</p>'; }
  }

  // ---------- VOUCHERS ----------
  async function loadVouchers() {
    const list = document.getElementById('vouchersList');
    list.innerHTML = '<p class="muted loading-msg">Memuatkan...</p>';
    try {
      const vouchers = await API.admin.vouchers.list();
      if (!vouchers.length) { list.innerHTML = '<p class="muted">Tiada voucher lagi.</p>'; return; }
      list.innerHTML = vouchers.map(v => `
        <div class="voucher-row-item">
          <div>
            <span class="voucher-code">${v.code}</span>
            <p class="muted" style="font-size:0.82rem">${v.description || '—'} · Guna: ${v.used_count}${v.max_uses ? '/' + v.max_uses : ''}</p>
          </div>
          <div style="display:flex;align-items:center;gap:0.8rem">
            <strong>RM${Number(v.discount_amount).toFixed(0)} off</strong>
            <span class="status-pill ${v.active ? 'status-completed' : 'status-cancelled'}">${v.active ? 'Aktif' : 'Tidak Aktif'}</span>
            <button class="btn btn-ghost btn-sm toggle-voucher-btn" data-id="${v.id}" data-active="${v.active}">
              ${v.active ? 'Nyahaktif' : 'Aktifkan'}
            </button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.toggle-voucher-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const active = btn.dataset.active === 'true';
          try {
            await API.admin.vouchers.update(btn.dataset.id, { active: !active });
            loadVouchers();
          } catch (err) { alert(err.message); }
        });
      });
    } catch { list.innerHTML = '<p class="muted">Gagal memuatkan voucher.</p>'; }
  }

  // ---------- SETTINGS ----------
  async function loadSettings() {
    try {
      const s = await API.admin.settings.get();
      document.getElementById('setToyyibKey').placeholder = s.toyyibpay_secret_key ? '••••••••••••' : 'Your ToyyibPay secret key';
      document.getElementById('setToyyibCat').value = s.toyyibpay_category_code || '';
      document.getElementById('setToyyibMode').value = s.toyyibpay_mode || 'sandbox';
      document.getElementById('setQrDetails').value = s.qr_details || '';
      document.getElementById('setBarberPct').value = s.commission_barber_pct || '70';
      document.getElementById('setOwnerPct').value = s.commission_owner_pct || '30';
      document.getElementById('setCleanupFee').value = s.cleanup_fee || '5';
      document.getElementById('setCleanupBarberPct').value = s.cleanup_barber_pct || '80';
      if (s.qr_image_url) {
        document.getElementById('qrPreview').src = s.qr_image_url;
        document.getElementById('qrPreviewWrap').style.display = '';
      }
    } catch {}
  }

  // ---------- INIT EVENTS ----------
  function initEvents() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await API.admin.logout();
      window.location.href = '/admin-login.html';
    });

    // Booking filter
    document.getElementById('bookingStatusFilter').addEventListener('change', loadBookings);

    // Generate payouts
    document.getElementById('generatePayoutsBtn').addEventListener('click', async () => {
      try {
        const r = await API.admin.payouts.generate();
        alert(`${r.created} rekod payout baru dijana.`);
        loadPayouts();
      } catch (err) { alert(err.message); }
    });

    // Add barber modal
    document.getElementById('addBarberBtn').addEventListener('click', async () => {
      const modal = document.getElementById('addBarberModal');
      const sel = document.getElementById('nb_location');
      if (sel.children.length <= 1) {
        const locs = await API.locations.list().catch(() => []);
        locs.forEach(l => sel.innerHTML += `<option value="${l.id}">${l.name}</option>`);
      }
      modal.style.display = 'flex';
    });
    document.getElementById('cancelAddBarberBtn').addEventListener('click', () => {
      document.getElementById('addBarberModal').style.display = 'none';
    });
    document.getElementById('confirmAddBarberBtn').addEventListener('click', async () => {
      const errEl = document.getElementById('addBarberError');
      const payload = {
        name: document.getElementById('nb_name').value,
        phone: document.getElementById('nb_phone').value,
        email: document.getElementById('nb_email').value,
        password: document.getElementById('nb_password').value,
        specialty: document.getElementById('nb_specialty').value,
        locationId: document.getElementById('nb_location').value || null
      };
      if (!payload.name || !payload.email || !payload.password) {
        errEl.textContent = 'Nama, emel, dan kata laluan diperlukan.';
        errEl.style.display = 'block'; return;
      }
      try {
        await API.admin.barbers.create(payload);
        document.getElementById('addBarberModal').style.display = 'none';
        loadBarbers();
      } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    });

    // Add voucher modal
    document.getElementById('addVoucherBtn').addEventListener('click', () => {
      document.getElementById('addVoucherModal').style.display = 'flex';
    });
    document.getElementById('cancelVoucherBtn').addEventListener('click', () => {
      document.getElementById('addVoucherModal').style.display = 'none';
    });
    document.getElementById('confirmVoucherBtn').addEventListener('click', async () => {
      const errEl = document.getElementById('addVoucherError');
      const payload = {
        code: document.getElementById('vc_code').value,
        discountAmount: document.getElementById('vc_discount').value,
        description: document.getElementById('vc_desc').value,
        maxUses: document.getElementById('vc_maxuses').value || null,
        expiresAt: document.getElementById('vc_expires').value || null,
      };
      if (!payload.code || !payload.discountAmount) {
        errEl.textContent = 'Kod dan amaun diskaun diperlukan.';
        errEl.style.display = 'block'; return;
      }
      try {
        await API.admin.vouchers.create(payload);
        document.getElementById('addVoucherModal').style.display = 'none';
        loadVouchers();
      } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    });

    // Settings — ToyyibPay
    document.getElementById('saveToyyibBtn').addEventListener('click', async () => {
      const key = document.getElementById('setToyyibKey').value;
      const cat = document.getElementById('setToyyibCat').value;
      const mode = document.getElementById('setToyyibMode').value;
      const updates = { toyyibpay_category_code: cat, toyyibpay_mode: mode };
      if (key && key !== '••••••••••••') updates.toyyibpay_secret_key = key;
      try {
        await API.admin.settings.update(updates);
        alert('Tetapan ToyyibPay disimpan!');
      } catch (err) { alert(err.message); }
    });

    // Settings — QR upload
    document.getElementById('saveQrBtn').addEventListener('click', async () => {
      const file = document.getElementById('qrFileInput').files[0];
      const details = document.getElementById('setQrDetails').value;

      if (file) {
        const formData = new FormData();
        formData.append('qr', file);
        try {
          const res = await fetch('/api/payment/qr-upload', {
            method: 'POST', credentials: 'include', body: formData
          }).then(r => r.json());
          if (res.url) {
            document.getElementById('qrPreview').src = res.url;
            document.getElementById('qrPreviewWrap').style.display = '';
          }
        } catch (err) { alert('Gagal muat naik QR: ' + err.message); return; }
      }

      if (details) {
        try { await API.admin.settings.update({ qr_details: details }); }
        catch {}
      }
      alert('Tetapan QR disimpan!');
    });

    // Settings — Commission
    document.getElementById('saveCommissionBtn').addEventListener('click', async () => {
      const barberPct = parseInt(document.getElementById('setBarberPct').value);
      const ownerPct = parseInt(document.getElementById('setOwnerPct').value);
      if (barberPct + ownerPct !== 100) {
        alert('Jumlah komisyen barber + owner mesti bersamaan 100%.'); return;
      }
      try {
        await API.admin.settings.update({
          commission_barber_pct: barberPct,
          commission_owner_pct: ownerPct,
          cleanup_fee: document.getElementById('setCleanupFee').value,
          cleanup_barber_pct: document.getElementById('setCleanupBarberPct').value,
        });
        alert('Komisyen disimpan!');
      } catch (err) { alert(err.message); }
    });
  }

  // ---------- INIT ----------
  async function init() {
    await checkAuth();
    initTabs();
    initEvents();
    await loadOverview();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
