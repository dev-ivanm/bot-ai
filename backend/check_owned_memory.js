const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function checkOwnedMemory() {
    console.log("=== REVISANDO MEMORIA CON DUEÑO ===");
    const { data: memory, error: memError } = await supabase
        .from('memoria_bot')
        .select('*')
        .not('user_id', 'is', null);
        
    if (memError) {
        console.error("Error fetching memory:", memError);
        return;
    }

    console.log(`Entradas con dueño: ${memory.length}`);
    memory.forEach(m => {
        console.log(`ID: ${m.id} | User ID: ${m.user_id} | Contenido: ${m.contenido}`);
    });

    console.log("\n=== REVISANDO USUARIOS AUTH ===");
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
        console.error("Error listing users:", userError);
        return;
    }
    users.forEach(u => {
        console.log(`Email: ${u.email} | ID: ${u.id}`);
    });
}

checkOwnedMemory();
