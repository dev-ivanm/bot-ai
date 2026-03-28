const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    const { data: pData, error: pErr } = await supabase.from('perfiles_bot').select('*').limit(1);
    if (pData && pData[0]) {
        console.log('--- COLUMNAS PERFILES_BOT ---');
        console.log(Object.keys(pData[0]).join(', '));
    }

    const { data: mData, error: mErr } = await supabase.from('memoria_bot').select('*').limit(1);
    if (mData && mData[0]) {
        console.log('\n--- COLUMNAS MEMORIA_BOT ---');
        console.log(Object.keys(mData[0]).join(', '));
    }
}

checkSchema();
