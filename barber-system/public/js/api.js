/* ============================================================
   BARBER GO — API CLIENT
   Thin wrapper around fetch() for all backend calls
   ============================================================ */

const API = {
  base: '/api',

  async _req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(path) { return this._req('GET', path); },
  post(path, body) { return this._req('POST', path, body); },
  put(path, body) { return this._req('PUT', path, body); },
  del(path) { return this._req('DELETE', path); },

  // Domain shortcuts
  locations: {
    list: () => API.get('/locations'),
  },
  services: {
    list: () => API.get('/services'),
  },
  booking: {
    create: (data) => API.post('/booking', data),
    applyVoucher: (code, serviceId) => API.post('/booking/voucher-check', { code, serviceId }),
    track: (id) => API.get('/booking/' + id),
  },
  barber: {
    login: (email, password) => API.post('/barber/login', { email, password }),
    logout: () => API.post('/barber/logout'),
    me: () => API.get('/barber/me'),
    jobs: () => API.get('/barber/jobs'),
    updateJobStatus: (id, status) => API.put('/barber/jobs/' + id, { status }),
    completeCleanup: (id, checklist) => API.put('/barber/jobs/' + id + '/cleanup', { checklist }),
    earnings: () => API.get('/barber/earnings'),
    customers: () => API.get('/barber/customers'),
    setAvailability: (data) => API.post('/barber/availability', data),
    setLocation: (locationId) => API.put('/barber/location', { locationId }),
    setStatus: (status) => API.put('/barber/status', { status }),
  },
  admin: {
    login: (email, password) => API.post('/admin/login', { email, password }),
    logout: () => API.post('/admin/logout'),
    me: () => API.get('/admin/me'),
    dashboard: () => API.get('/admin/dashboard'),
    barbers: {
      list: () => API.get('/admin/barbers'),
      create: (data) => API.post('/admin/barbers', data),
      detail: (id) => API.get('/admin/barbers/' + id),
      update: (id, data) => API.put('/admin/barbers/' + id, data),
    },
    bookings: {
      list: (q) => API.get('/admin/bookings' + (q ? '?' + q : '')),
      update: (id, data) => API.put('/admin/bookings/' + id, data),
    },
    payouts: {
      list: () => API.get('/admin/payouts'),
      generate: () => API.post('/admin/payouts/generate'),
      markPaid: (id) => API.put('/admin/payouts/' + id + '/paid'),
    },
    vouchers: {
      list: () => API.get('/admin/vouchers'),
      create: (data) => API.post('/admin/vouchers', data),
      update: (id, data) => API.put('/admin/vouchers/' + id, data),
    },
    services: {
      update: (id, data) => API.put('/services/' + id, data),
      create: (data) => API.post('/services', data),
    },
    settings: {
      get: () => API.get('/admin/settings'),
      update: (data) => API.put('/admin/settings', data),
    },
    locations: {
      create: (name) => API.post('/locations', { name }),
    }
  }
};
