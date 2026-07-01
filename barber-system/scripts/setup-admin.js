// Run this ONCE after deploying, to create your admin login.
// Usage: node scripts/setup-admin.js youremail@example.com yourpassword "Your Name"

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const [,, email, password, name] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/setup-admin.js <email> <password> "<name>"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const hash = bcrypt.hashSync(password, 10);
  const { data, error } = await supabase
    .from('admins')
    .upsert({ email, password: hash, name: name || 'Owner' }, { onConflict: 'email' })
    .select();

  if (error) {
    console.error('❌ Failed to create admin:', error.message);
    process.exit(1);
  }
  console.log('✅ Admin account ready:', email);
  console.log('   You can now log in at /admin-login.html');
}

main();
