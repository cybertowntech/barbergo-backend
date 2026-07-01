/* ============================================================
   BARBER DASHBOARD LOGIC
   ============================================================ */
(function () {
  let allJobs = [];
  let currentCleanupJobId = null;

  const DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const STATUS_LABELS = {
    pending: 'Pending', confirmed: 'Disahkan', on_the_way: 'Dalam Perjalanan',
    arrived: 'Tiba', in_progress: 'Sedang Potong', completed: 'Selesai', cancelled: 'Dibatalkan'
  };
  const STATUS_NEXT = {
    pending: { label: 'Confirm Job', next: 'confirmed' },
    confirmed: { label: 'On The Way', next: 'on_the_way' },
    on_the_way: { label: 'Saya Tiba', next: 'arrived' },
    arrived: { label: 'Mula Potong', next: 'in_progress' },
    in_progress: { label: 'Selesai Job', next: 'completed' },
  };

  // ---------- AUTH CHECK ----------
  async function checkAuth() {
    try {
      const me = await API.barber.me();
      document.getElementById('barberName').textContent = me.name;
      document.getElementById('barberAvatar').textContent = me.name.charAt(0).toUpperCase();
      const statusSel = document.getElementById('statusSelect');
      if (statusSel) statusSel.value = me.status || 'available';
      return me;
    } catch {
      window.location.href = '/barber-login.html';
    }
  }

  // ---------- TAB NAVIGATION ----------
  function initTabs() {
    document.querySelectorAll('.nav-item[data-tab]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
        if (tab === 'earnings') loadEarnings();
        if (tab === 'customers') loadCustomers();
        if (tab === 'schedule') loadSchedule();
      });
    });
  }

  // ---------- JOBS ----------
  async function loadJobs() {
    const list = document.getElementById('jobsList');
    list.innerHTML = '<p class="muted loading-msg">Memuatkan job...</p>';
    try {
      allJobs = await API.barber.jobs();
      renderJobs();
    } catch {
      list.innerHTML = '<p class="muted">Gagal memuatkan job.</p>';
    }
  }

  function renderJobs() {
    const filter = document.getElementById('jobFilter').value;
    const list = document.getElementById('jobsList');
    const filtered = filter === 'all' ? allJobs : allJobs.filter(j => j.status === filter);

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-card"><p class="muted">Tiada job ditemui.</p></div>';
      return;
    }

    list.innerHTML = filtered.map(job => {
      const next = STATUS_NEXT[job.status];
      const isCleanup = job.cleanup_option === 'barber';
      return `
        <div class="job-card card">
          <div class="job-card-head">
            <div>
              <span class="job-id">#${job.id}</span>
              <h3>${job.service_name}</h3>
              <p class="muted">${job.customer_name} · ${job.customer_phone}</p>
            </div>
            <span class="status-pill status-${job.status}">${STATUS_LABELS[job.status] || job.status}</span>
          </div>
          <div class="job-meta">
            <span>📅 ${job.booking_date} ${job.booking_time}</span>
            <span>📍 ${job.address}</span>
            ${isCleanup ? '<span class="cleanup-badge">🧹 Barber Kemas</span>' : ''}
          </div>
          <div class="job-footer">
            <span class="job-earning">Upah: <strong>RM${Number(job.barber_earning).toFixed(0)}</strong></span>
            <div class="job-actions">
              ${job.status === 'in_progress' && isCleanup
                ? `<button class="btn btn-sm btn-primary" data-cleanup="${job.id}">Checklist Kemas</button>`
                : next
                ? `<button class="btn btn-sm btn-primary" data-next="${job.status}" data-id="${job.id}">${next.label}</button>`
                : ''}
              ${job.status === 'completed' && job.rating
                ? `<span class="rating-star">⭐ ${job.rating}/5</span>`
                : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-next]').forEach(btn => {
      btn.addEventListener('click', () => advanceJob(btn.dataset.id, btn.dataset.next));
    });
    list.querySelectorAll('[data-cleanup]').forEach(btn => {
      btn.addEventListener('click', () => openCleanupModal(btn.dataset.cleanup));
    });
  }

  async function advanceJob(id, currentStatus) {
    const next = STATUS_NEXT[currentStatus];
    if (!next) return;

    if (next.next === 'completed') {
      const job = allJobs.find(j => String(j.id) === String(id));
      if (job && job.cleanup_option === 'barber') {
        openCleanupModal(id);
        return;
      }
    }

    try {
      await API.barber.updateJobStatus(id, next.next);
      await loadJobs();
    } catch (err) {
      alert('Ralat: ' + err.message);
    }
  }

  function openCleanupModal(jobId) {
    currentCleanupJobId = jobId;
    document.querySelectorAll('[name="cl"]').forEach(c => c.checked = false);
    document.getElementById('cleanupModal').style.display = 'flex';
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cancelChecklistBtn').addEventListener('click', () => {
      document.getElementById('cleanupModal').style.display = 'none';
    });

    document.getElementById('confirmChecklistBtn').addEventListener('click', async () => {
      const checklist = {};
      document.querySelectorAll('[name="cl"]').forEach(c => { checklist[c.value] = c.checked; });
      const required = ['sheet_removed', 'floor_cleaned', 'hair_bagged', 'chair_wiped', 'area_clean'];
      const allDone = required.every(k => checklist[k]);
      if (!allDone) { alert('Sila tick semua item sebelum tamat job.'); return; }

      try {
        await API.barber.completeCleanup(currentCleanupJobId, checklist);
        await API.barber.updateJobStatus(currentCleanupJobId, 'completed');
        document.getElementById('cleanupModal').style.display = 'none';
        await loadJobs();
      } catch (err) {
        alert('Ralat: ' + err.message);
      }
    });
  });

  // ---------- EARNINGS ----------
  async function loadEarnings() {
    try {
      const data = await API.barber.earnings();
      const s = data.summary;
      document.getElementById('totalEarned').textContent = 'RM' + s.totalEarned.toFixed(2);
      document.getElementById('totalPaid').textContent = 'RM' + s.totalPaid.toFixed(2);
      document.getElementById('pendingPay').textContent = 'RM' + s.pending.toFixed(2);
      document.getElementById('totalJobCount').textContent = s.totalJobs;

      const payoutsList = document.getElementById('payoutsList');
      if (!data.payouts.length) {
        payoutsList.innerHTML = '<p class="muted">Tiada rekod pembayaran lagi.</p>';
      } else {
        payoutsList.innerHTML = data.payouts.map(p => `
          <div class="payout-row">
            <div>
              <strong>${p.week_start} — ${p.week_end}</strong>
              <p class="muted">${p.total_jobs} job</p>
            </div>
            <div style="text-align:right">
              <strong>RM${Number(p.total_amount).toFixed(2)}</strong>
              <span class="status-pill ${p.status === 'paid' ? 'status-completed' : 'status-pending'}">${p.status === 'paid' ? '✓ Dibayar' : 'Belum Bayar'}</span>
            </div>
          </div>
        `).join('');
      }

      const completedJobs = data.jobs;
      const compList = document.getElementById('completedJobsList');
      if (!completedJobs.length) {
        compList.innerHTML = '<p class="muted">Tiada job selesai lagi.</p>';
      } else {
        compList.innerHTML = completedJobs.slice(0, 30).map(j => `
          <div class="job-card card compact-card">
            <div class="job-card-head">
              <div>
                <span class="job-id">#${j.id}</span>
                <h3>${j.service_name}</h3>
                <p class="muted">${j.booking_date} ${j.booking_time}</p>
              </div>
              <strong class="job-earning">RM${Number(j.barber_earning).toFixed(2)}</strong>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      document.getElementById('earningsSummary').innerHTML = '<p class="muted">Gagal memuatkan earnings.</p>';
    }
  }

  // ---------- CUSTOMERS ----------
  async function loadCustomers() {
    const list = document.getElementById('customersList');
    list.innerHTML = '<p class="muted loading-msg">Memuatkan...</p>';
    try {
      const customers = await API.barber.customers();
      if (!customers.length) { list.innerHTML = '<p class="muted">Belum ada pelanggan lagi.</p>'; return; }
      list.innerHTML = `
        <div class="customers-grid">
          ${customers.map(c => `
            <div class="customer-card card card-pad">
              <div class="customer-avatar">${c.name.charAt(0).toUpperCase()}</div>
              <h4>${c.name}</h4>
              <p class="muted">${c.phone}</p>
              <div class="customer-stats">
                <span>${c.visit_count}x kunjungan</span>
                <span>Terakhir: ${c.last_visit}</span>
              </div>
            </div>
          `).join('')}
        </div>`;
    } catch {
      list.innerHTML = '<p class="muted">Gagal memuatkan pelanggan.</p>';
    }
  }

  // ---------- SCHEDULE & LOCATION ----------
  async function loadSchedule() {
    try {
      const locs = await API.locations.list();
      const sel = document.getElementById('locationSelect');
      locs.forEach(l => {
        if (!sel.querySelector(`option[value="${l.id}"]`)) {
          sel.innerHTML += `<option value="${l.id}">${l.name}</option>`;
        }
      });

      const me = await API.barber.me();
      if (me.location_id) sel.value = me.location_id;

      const avail = await API.barber.setAvailability ? [] : await fetch('/api/barber/availability', { credentials: 'include' }).then(r => r.json()).catch(() => []);
      renderAvailability(avail);
    } catch {}
  }

  function renderAvailability(saved) {
    const form = document.getElementById('availabilityForm');
    form.innerHTML = DAYS.map((day, i) => {
      const existing = saved.find(s => s.day_of_week === i) || {};
      const isOff = existing.is_off !== undefined ? existing.is_off : (i === 0 || i === 6);
      return `
        <div class="avail-row">
          <label class="avail-day">
            <input type="checkbox" class="avail-off" data-day="${i}" ${!isOff ? 'checked' : ''}> ${day}
          </label>
          <input type="time" class="avail-start text-input-sm" data-day="${i}" value="${existing.start_time || '09:00'}">
          <span class="avail-sep">hingga</span>
          <input type="time" class="avail-end text-input-sm" data-day="${i}" value="${existing.end_time || '18:00'}">
        </div>
      `;
    }).join('');
  }

  // ---------- EVENT LISTENERS ----------
  async function initEvents() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await API.barber.logout();
      window.location.href = '/barber-login.html';
    });

    document.getElementById('statusSelect').addEventListener('change', async (e) => {
      try { await API.barber.setStatus(e.target.value); }
      catch (err) { alert('Gagal tukar status: ' + err.message); }
    });

    document.getElementById('jobFilter').addEventListener('change', renderJobs);

    document.getElementById('saveLocationBtn').addEventListener('click', async () => {
      const val = document.getElementById('locationSelect').value;
      if (!val) { alert('Sila pilih kawasan.'); return; }
      try {
        await API.barber.setLocation(val);
        alert('Kawasan disimpan!');
      } catch (err) { alert('Ralat: ' + err.message); }
    });

    document.getElementById('saveAvailBtn').addEventListener('click', async () => {
      const schedule = DAYS.map((_, i) => {
        const on = document.querySelector(`.avail-off[data-day="${i}"]`).checked;
        return {
          day_of_week: i,
          is_off: !on,
          start_time: document.querySelector(`.avail-start[data-day="${i}"]`).value,
          end_time: document.querySelector(`.avail-end[data-day="${i}"]`).value,
        };
      });
      try {
        await fetch('/api/barber/availability', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule })
        });
        alert('Jadual disimpan!');
      } catch { alert('Gagal simpan jadual.'); }
    });

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }
  }

  // ---------- INIT ----------
  async function init() {
    await checkAuth();
    initTabs();
    await initEvents();
    await loadJobs();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
