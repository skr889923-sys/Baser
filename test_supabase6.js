require('dotenv').config({ path: 'apps/admin/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const id = crypto.randomUUID();
  const { data, error } = await supabase.from('profiles').insert([{ id }]).select();
  console.log('Insert error:', error);
}
test();
