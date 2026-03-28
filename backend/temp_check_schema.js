const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkColumns() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.from('memoria_bot').select('*').limit(50);
  
  if (error) {
    console.error('ERROR:', error);
    return;
  }

  const allKeys = new Set();
  data.forEach(row => {
    Object.keys(row).forEach(key => allKeys.add(key));
  });

  console.log('COLUMNS:', Array.from(allKeys));
  
  // Also check a few rows to see what data looks like
  console.log('SAMPLE DATA:', JSON.stringify(data.slice(0, 2), null, 2));
}

checkColumns();
