require('dotenv').config({ path: 'apps/admin/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles:', data, error);
}
test();
