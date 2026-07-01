# BarberGo — Mobile Barber Booking Platform

**We Go. You Sit.**

## Tech Stack
- **Frontend:** HTML/CSS/JS (multi-page, GSAP + Lenis animations)
- **Backend:** Node.js + Express
- **Database:** Supabase (Postgres)
- **Payment:** ToyyibPay (FPX/Card) + QR + Cash
- **File Storage:** Supabase Storage (for QR images, barber photos)

---

## STEP 1 — Setup Supabase

1. Pergi ke [supabase.com](https://supabase.com) → Create new project
2. Tunggu project provision (~2 minit)
3. Pergi ke **SQL Editor → New Query**
4. Copy semua kandungan fail `supabase-schema.sql` → Paste → Run
5. Pergi ke **Settings → API**, copy:
   - `Project URL`
   - `service_role` secret key (BUKAN anon key)
6. Pergi ke **Storage → Create bucket** → nama: `public-assets` → toggle **Public bucket**

---

## STEP 2 — Setup Project

```bash
# Clone / download project
cd barber-system

# Install dependencies
npm install

# Copy env file
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=any-long-random-string-here
PORT=3000
```

---

## STEP 3 — Create Admin Account

```bash
node scripts/setup-admin.js youremail@example.com yourpassword "Nama Anda"
```

Contoh:
```bash
node scripts/setup-admin.js admin@barbergo.my Admin@123 "Owner"
```

---

## STEP 4 — Run Server

```bash
# Development
npm start

# Production (recommended: use PM2)
npm install -g pm2
pm2 start server.js --name barbergo
pm2 save
pm2 startup
```

Server akan jalan di `http://localhost:3000`

---

## STEP 5 — Configure Payment (dalam Admin Panel)

1. Login di `/admin-login.html`
2. Pergi ke tab **Tetapan**
3. Masukkan ToyyibPay Secret Key + Category Code
4. Upload gambar QR (dari bank/TNG/etc)
5. Simpan

---

## Pages

| URL | Fungsi |
|-----|--------|
| `/` | Home page (public) |
| `/services.html` | Senarai 27 haircut + harga |
| `/about.html` | About Us |
| `/booking.html` | Multi-step booking form |
| `/booking-confirmation.html` | Konfirmasi selepas book |
| `/barber-login.html` | Login barber |
| `/barber-dashboard.html` | Dashboard barber |
| `/admin-login.html` | Login admin/owner |
| `/admin-dashboard.html` | Admin panel penuh |

---

## API Endpoints

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/api/services` | Semua servis + harga |
| GET | `/api/locations` | Semua kawasan |
| POST | `/api/booking` | Buat booking baru |
| POST | `/api/booking/voucher-check` | Validate voucher |
| GET | `/api/booking/:id` | Track booking |
| GET | `/api/booking/available-barbers` | Barber available |
| POST | `/api/barber/login` | Barber login |
| GET | `/api/barber/jobs` | Job list (barber) |
| PUT | `/api/barber/jobs/:id` | Update job status |
| GET | `/api/barber/earnings` | Earnings tracker |
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/dashboard` | Overview stats |
| GET | `/api/admin/barbers` | Semua barber |
| GET | `/api/admin/barbers/:id` | Detail 1 barber |
| GET | `/api/admin/payouts` | Payout list |
| POST | `/api/admin/payouts/generate` | Jana payout mingguan |
| PUT | `/api/admin/payouts/:id/paid` | Mark gaji dibayar |
| GET/POST | `/api/admin/vouchers` | Manage vouchers |
| GET/PUT | `/api/admin/settings` | System settings |
| POST | `/api/payment/toyyibpay/create-bill` | Buat bil ToyyibPay |
| POST | `/api/payment/qr-upload` | Upload QR image |
| PUT | `/api/payment/:id/mark-paid` | Mark cash/QR paid |

---

## Deploy ke Hosting

### Railway (paling senang)
1. Push ke GitHub
2. Connect repo ke [railway.app](https://railway.app)
3. Add environment variables dalam Railway dashboard
4. Railway auto-detect Node.js dan deploy

### Render
1. Push ke GitHub
2. Create Web Service di [render.com](https://render.com)
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add env vars

### VPS (cPanel / Ubuntu)
1. Upload files via FTP / Git
2. Install Node.js
3. `npm install`
4. Setup PM2 (step 4 atas)
5. Setup Nginx reverse proxy ke port 3000

---

## Default Login (selepas run setup-admin.js)
- URL: `/admin-login.html`
- Guna email & password yang anda set semasa `setup-admin.js`

## Barber Login
- Barber accounts dibuat oleh admin dalam Admin Panel → tab Barber → Tambah Barber
- Barber login di `/barber-login.html`
