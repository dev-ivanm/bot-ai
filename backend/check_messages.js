const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: msgs, error } = await supabase.from('mensajes_wa').select('*').order('created_at', { ascending: false }).limit(5);
    if (error) console.error(error);
    else console.log(msgs.map(m => `[${m.created_at}] ${m.es_mio ? 'Bot' : 'User'} (${m.remote_jid}): ${m.mensaje_texto}`));
}
check();
