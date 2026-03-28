const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

async function cleanupMemory() {
    console.log("=== INICIANDO LIMPIEZA DE MEMORIA SIN DUEÑO ===");
    
    // Borrar todo lo que no tenga user_id assigned
    const { count, error } = await supabase
        .from('memoria_bot')
        .delete({ count: 'exact' })
        .is('user_id', null);
        
    if (error) {
        console.error("Error cleaning memory:", error);
        return;
    }

    console.log(`Se han eliminado ${count} entradas huérfanas.`);
    console.log("Sistema bloqueado. Ahora solo se mostrará memoria con dueño explícito.");
}

cleanupMemory();
