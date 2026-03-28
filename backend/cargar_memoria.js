const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables desde el .env (ahora en la misma carpeta)
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.error("❌ No se encontró el archivo .env");
    process.exit(1);
}
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

// PASO 1: Obtener el userId del argumento de la línea de comandos
const userId = process.argv[2];

if (!userId) {
    console.error("❌ Error: Debes proporcionar el UUID del usuario.");
    console.log("Uso: node cargar_memoria.js <UUID_DEL_USUARIO>");
    process.exit(1);
}

const dataToInsert = [
    { contenido: 'Zapatos Nike Caballero: Tenemos modelos Running y Casual. Precio: $25.', user_id: userId },
    { contenido: 'Zapatos Nike Dama: Disponibles en colores rosa, blanco y negro. Precio: $20.', user_id: userId },
    { contenido: 'Nuestra tienda fisica esta ubicada en El Junquito, Caracas.', user_id: userId },
    { contenido: 'Aceptamos pagos via Pago Movil, Zelle y Efectivo.', user_id: userId },
    { contenido: 'El horario de atencion es de Lunes a Viernes de 9:00 AM a 6:00 PM.', user_id: userId },
    { contenido: 'Zapatos Nike: Sí, tenemos disponibilidad inmediata en tallas del 36 al 44.', user_id: userId }
];

async function seed() {
    console.log(`🚀 Iniciando carga de memoria para el usuario: ${userId}...`);
    const { data, error } = await supabase
        .from('memoria_bot')
        .insert(dataToInsert);

    if (error) {
        console.error("❌ Error al cargar datos:", error.message);
    } else {
        console.log("✅ Memoria cargada exitosamente. El bot ahora tiene su conocimiento personalizado.");
    }
}

seed();
