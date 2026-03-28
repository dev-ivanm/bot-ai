const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function checkMemory() {
    console.log("=== REVISANDO TABLA memoria_bot ===");
    const { data: memory, error: memError } = await supabase.from('memoria_bot').select('*');
    if (memError) {
        console.error("Error fetching memory:", memError);
        return;
    }

    const { data: profiles, error: profError } = await supabase.from('perfiles_bot').select('id, email, instance_name');
    if (profError) {
        console.error("Error fetching profiles:", profError);
        return;
    }

    console.log(`Total de entradas en memoria: ${memory.length}`);
    memory.forEach(m => {
        const owner = profiles.find(p => p.id === m.user_id);
        console.log(`ID: ${m.id}`);
        console.log(`User ID: ${m.user_id} (${owner ? owner.email : 'SIN DUEÑO'})`);
        console.log(`Contenido: ${m.contenido.substring(0, 50)}...`);
        console.log('---------------------------');
    });

    console.log("\n=== REVISANDO PERFILES ===");
    profiles.forEach(p => {
        console.log(`User: ${p.email} | ID: ${p.id} | Instance: ${p.instance_name}`);
    });
}

checkMemory();
