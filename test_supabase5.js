require('dotenv').config({ path: 'apps/admin/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('profiles').insert([{ id: '123' }]).select();
  console.log('Insert error:', error);
}
test();
