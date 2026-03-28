const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function dumpMemory() {
    console.log('--- DUMPING ALL MEMORIA_BOT ---');
    const { data, error } = await supabase.from('memoria_bot').select('*');
    if (error) {
        console.error(error);
    } else {
        console.log(`Total: ${data.length} records.`);
        data.forEach(r => {
            console.log(`UserID: ${r.user_id} | Content: ${r.contenido.substring(0, 50)}...`);
        });
    }
}

dumpMemory();
