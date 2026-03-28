const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function checkIds() {
    console.log('--- PERFILES_BOT ---');
    const { data: profiles, error: pErr } = await supabase.from('perfiles_bot').select('id, user_id, instance_name');
    if (pErr) console.error('Error profiles:', pErr);
    else (profiles || []).forEach(p => console.log(`ID: ${p.id} | UserID: ${p.user_id} | Instance: ${p.instance_name}`));

    console.log('\n--- MEMORIA_BOT ---');
    const { data: memory, error: mErr } = await supabase.from('memoria_bot').select('id, user_id, contenido').limit(3);
    if (mErr) console.error('Error memory:', mErr);
    else (memory || []).forEach(m => console.log(`ID: ${m.id} | UserID: ${m.user_id} | Contenido: ${m.contenido.substring(0, 30)}...`));
}

checkIds();
