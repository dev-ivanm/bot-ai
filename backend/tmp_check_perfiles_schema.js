const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSchema() {
    console.log(`--- Checking 'perfiles_usuario' Schema ---`);

    const { data, error } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No data found in perfiles_usuario.');
    }
}

checkSchema();
