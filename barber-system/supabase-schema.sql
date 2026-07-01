-- ============================================================
-- BARBER GO — SUPABASE SCHEMA
-- Run this entire file once in Supabase SQL Editor
-- (Project → SQL Editor → New Query → paste → Run)
-- ============================================================

-- ===== LOCATIONS =====
create table if not exists locations (
  id bigint generated always as identity primary key,
  name text unique not null
);

-- ===== SERVICES =====
create table if not exists services (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  price numeric(10,2) not null,
  type text not null default 'haircut', -- haircut | addon
  active boolean default true
);

-- ===== BARBERS =====
create table if not exists barbers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  email text unique not null,
  password text not null, -- bcrypt hash
  photo_url text,
  specialty text,
  location_id bigint references locations(id),
  status text default 'available', -- available | busy | offline
  rating numeric(3,2) default 5.0,
  total_jobs integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- ===== BARBER AVAILABILITY =====
create table if not exists barber_availability (
  id bigint generated always as identity primary key,
  barber_id bigint references barbers(id) on delete cascade,
  day_of_week int not null, -- 0=Sunday .. 6=Saturday
  start_time text,
  end_time text,
  is_off boolean default false
);

-- ===== CUSTOMERS =====
create table if not exists customers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  email text,
  address text,
  location_id bigint references locations(id),
  loyalty_points integer default 0,
  created_at timestamptz default now()
);
create unique index if not exists customers_phone_idx on customers(phone);

-- ===== VOUCHERS =====
create table if not exists vouchers (
  id bigint generated always as identity primary key,
  code text unique not null,
  discount_amount numeric(10,2) not null,
  description text,
  max_uses integer,
  used_count integer default 0,
  active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ===== BOOKINGS =====
create table if not exists bookings (
  id bigint generated always as identity primary key,
  customer_id bigint not null references customers(id),
  barber_id bigint references barbers(id),
  location_id bigint references locations(id),
  service_id bigint not null references services(id),
  addon_ids jsonb default '[]',
  cleanup_option text default 'self', -- self | barber
  voucher_id bigint references vouchers(id),
  booking_date text not null,
  booking_time text not null,
  address text not null,
  original_price numeric(10,2) not null,
  voucher_discount numeric(10,2) default 0,
  final_price numeric(10,2) not null,
  barber_earning numeric(10,2) not null,
  owner_earning numeric(10,2) not null,
  payment_method text, -- toyyibpay | qr | cash
  payment_status text default 'pending', -- pending | paid | failed
  status text default 'pending', -- pending|confirmed|on_the_way|arrived|in_progress|completed|cancelled
  cleanup_checklist jsonb default '{}',
  rating integer,
  review text,
  created_at timestamptz default now()
);

-- ===== PAYOUTS =====
create table if not exists payouts (
  id bigint generated always as identity primary key,
  barber_id bigint not null references barbers(id),
  week_start text not null,
  week_end text not null,
  total_jobs integer not null,
  total_amount numeric(10,2) not null,
  status text default 'unpaid', -- unpaid | paid
  paid_at timestamptz
);

-- ===== ADMINS =====
create table if not exists admins (
  id bigint generated always as identity primary key,
  email text unique not null,
  password text not null,
  name text
);

-- ===== SETTINGS =====
create table if not exists settings (
  key text primary key,
  value text
);

-- ============================================================
-- SEED DATA
-- ============================================================

insert into locations (name) values
  ('Damansara'), ('Petaling Jaya'), ('Subang Jaya'), ('Shah Alam'),
  ('Kepong'), ('Mont Kiara'), ('Cheras'), ('Puchong')
on conflict (name) do nothing;

insert into services (name, category, price, type) values
  ('Low Fade', 'Fade Styles', 16, 'haircut'),
  ('Mid Fade', 'Fade Styles', 18, 'haircut'),
  ('High Fade', 'Fade Styles', 18, 'haircut'),
  ('Low Taper Fade', 'Fade Styles', 20, 'haircut'),
  ('Drop Fade', 'Fade Styles', 20, 'haircut'),
  ('Burst Fade', 'Fade Styles', 22, 'haircut'),
  ('Skin Fade', 'Fade Styles', 22, 'haircut'),
  ('High Skin Fade', 'Fade Styles', 24, 'haircut'),
  ('Bald Fade', 'Fade Styles', 26, 'haircut'),
  ('Induction Cut', 'Taper Styles', 10, 'haircut'),
  ('Buzz Cut', 'Taper Styles', 12, 'haircut'),
  ('Military Style', 'Taper Styles', 12, 'haircut'),
  ('Crew Cut', 'Taper Styles', 15, 'haircut'),
  ('Regular Taper', 'Taper Styles', 16, 'haircut'),
  ('Taper Cut', 'Taper Styles', 18, 'haircut'),
  ('Side Part', 'Classic & Modern', 15, 'haircut'),
  ('Messy Hair', 'Classic & Modern', 15, 'haircut'),
  ('Classic Comb Over', 'Classic & Modern', 18, 'haircut'),
  ('French Crop', 'Classic & Modern', 18, 'haircut'),
  ('Line Up / Shape Up', 'Classic & Modern', 18, 'haircut'),
  ('Undercut', 'Classic & Modern', 20, 'haircut'),
  ('Textured Crop', 'Classic & Modern', 20, 'haircut'),
  ('Quiff', 'Classic & Modern', 22, 'haircut'),
  ('Pompadour', 'Classic & Modern', 26, 'haircut'),
  ('Mohawk', 'Bold & Statement', 22, 'haircut'),
  ('Modern Mullet', 'Bold & Statement', 22, 'haircut'),
  ('Beard Trim', 'Add-on', 8, 'addon'),
  ('Line Up Only', 'Add-on', 6, 'addon'),
  ('Hair Wash', 'Add-on', 5, 'addon'),
  ('Razor Finish', 'Add-on', 4, 'addon'),
  ('Kids Cut', 'Add-on', 12, 'addon')
on conflict do nothing;

insert into settings (key, value) values
  ('toyyibpay_secret_key', ''),
  ('toyyibpay_category_code', ''),
  ('toyyibpay_mode', 'sandbox'),
  ('qr_image_url', ''),
  ('qr_details', ''),
  ('commission_barber_pct', '70'),
  ('commission_owner_pct', '30'),
  ('cleanup_fee', '5'),
  ('cleanup_barber_pct', '80')
on conflict (key) do nothing;

-- Default admin account is created by running `npm run setup-admin` after deploy
-- (see README.md) — this generates a real bcrypt hash, not a placeholder one.

-- ============================================================
-- ROW LEVEL SECURITY
-- We use the service_role key from our Node backend (bypasses RLS),
-- so the browser/anon key never talks to the DB directly.
-- Enabling RLS + no public policies = locked down by default.
-- ============================================================
alter table locations enable row level security;
alter table services enable row level security;
alter table barbers enable row level security;
alter table barber_availability enable row level security;
alter table customers enable row level security;
alter table vouchers enable row level security;
alter table bookings enable row level security;
alter table payouts enable row level security;
alter table admins enable row level security;
alter table settings enable row level security;

-- Allow public read-only access to locations & active services
-- (so the booking page can list them even before login, via anon key if ever used)
create policy "Public can view locations" on locations for select using (true);
create policy "Public can view active services" on services for select using (active = true);
