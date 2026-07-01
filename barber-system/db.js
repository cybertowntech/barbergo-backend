// ============================================================
// SUPABASE CLIENT
// Uses the SERVICE ROLE key — this file only ever runs on the
// server (Node backend), never sent to the browser. The service
// role key bypasses Row Level Security, which is safe here because
// our Express routes are the ones enforcing who can do what
// (req.session.adminId / req.session.barberId checks).
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file.');
  console.error('   Copy .env.example to .env and fill in your Supabase project credentials.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function getSetting(key) {
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
  if (error) return null;
  return data ? data.value : null;
}

async function setSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
  return !error;
}

module.exports = { supabase, getSetting, setSetting };
