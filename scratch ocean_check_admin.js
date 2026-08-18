const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const envVars = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const adminId = '30496218-c26b-4959-9969-24c35efe4b69';
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', adminId).maybeSingle();
  const { data: allow } = await supabase.from('allowed_users').select('*').eq('email', 'icecube3912@gmail.com').maybeSingle();
  console.log('Profile:', prof);
  console.log('Allowed:', allow);

  // If must_change_password is not set or false in DB, set app_metadata.must_change_password to false
  const mustChange = Boolean(prof?.must_change_password || allow?.must_change_password);
  await supabase.auth.admin.updateUserById(adminId, {
    app_metadata: {
      role: 'admin',
      must_change_password: mustChange,
    }
  });

  const { data: updated } = await supabase.auth.admin.getUserById(adminId);
  console.log('Final Admin app_metadata:', updated.user.app_metadata);
}

run();
