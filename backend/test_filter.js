const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

const testUserId = '6174ffe3-f360-4af1-b6f4-9634ce157ba6'; // Super Admin

async function testFilter() {
    console.log(`Testing filter for userId: ${testUserId}`);
    const { data, error } = await supabase
        .from('memoria_bot')
        .select('*')
        .eq('user_id', testUserId)
        .not('user_id', 'is', null);

    if (error) {
        console.error("Query error:", error);
    } else {
        console.log(`Results found: ${data.length}`);
        data.forEach(m => console.log(` - ${m.contenido}`));
    }
}

testFilter();
