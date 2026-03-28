const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function checkProfiles() {
    const { data, error } = await supabase.from('perfiles_bot').select('*');
    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }
    console.log("=== PERFILES ENCONTRADOS ===");
    data.forEach(p => {
        console.log(`ID: ${p.id}`);
        console.log(`Instance: ${p.instance_name}`);
        console.log(`Prompt (primeros 100 caracteres): ${p.prompt_sistema?.substring(0, 100)}...`);
        console.log('---------------------------');
    });
}

checkProfiles();
