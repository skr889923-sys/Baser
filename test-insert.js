const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hpwcfgfebgvqkyerdzrh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwd2NmZ2ZlYmd2cWt5ZXJkenJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MzYyNzgsImV4cCI6MjA5NzUxMjI3OH0.3jk3cWUpUeoyWhIXL9HhmB8qm9Rc7_bMNMTiJzbsIE4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  const { data, error } = await supabase.from('navigation_points').insert([{
    name_ar: 'نقطة جديدة',
    name_en: 'New Point',
    type: 'entrance',
    latitude: 30.622971,
    longitude: 32.269073,
    description_ar: 'تم إنشاؤه عبر لوحة التحكم',
    description_en: 'Created via admin panel',
    audio_instruction_ar: '',
    audio_instruction_en: '',
    is_accessible: true,
    is_hazard: false,
    is_active: true
  }]).select();

  console.log("Error:", error);
  console.log("Data:", data);
}

testInsert();
