const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getDeepSeekResponse } = require('./services/deepseek');

// Cargar variables desde el .env local
const envPath = path.join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_KEY);

const EVOLUTION_API_URL = envConfig.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = envConfig.EVOLUTION_API_KEY;

async function sendWhatsAppMessage(instanceName, number, text) {
    try {
        const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
            body: JSON.stringify({ number, text, delay: 1000 })
        });
        return response.ok;
    } catch (e) {
        console.error("Error enviando mensaje:", e);
        return false;
    }
}

async function processPending() {
    console.log("🔍 Escaneando mensajes pendientes de 'zapatos nike'...");
    
    // 1. Buscar mensajes que contengan el texto y no sean mios
    const { data: messages, error } = await supabase
        .from('mensajes_wa')
        .select('*')
        .ilike('mensaje_texto', '%zapatos nike%')
        .eq('es_mio', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error buscando mensajes:", error);
        return;
    }

    console.log(`Encontrados ${messages.length} mensajes potenciales.`);

    for (const msg of messages) {
        const remoteJid = msg.remote_jid;
        
        const { data: perfil } = await supabase
            .from('perfiles_bot')
            .select('*')
            .eq('id', msg.perfil_id)
            .single();
            
        if (!perfil) continue;
        const instanceName = perfil.instance_name;

        // Verificar si ya respondimos
        const { data: myResp } = await supabase
            .from('mensajes_wa')
            .select('id')
            .eq('remote_jid', remoteJid)
            .eq('es_mio', true)
            .gt('created_at', msg.created_at);

        if (myResp && myResp.length > 0) {
            console.log(`[Chat ${remoteJid}] Ya fue respondido antes, pero forzaremos una respuesta nueva...`);
            // continue;
        }

        console.log(`[Chat ${remoteJid}] Procesando respuesta AI...`);

        // 2. Obtener contexto
        const { data: history } = await supabase
            .from('mensajes_wa')
            .select('mensaje_texto, es_mio')
            .eq('remote_jid', remoteJid)
            .order('created_at', { ascending: false })
            .limit(10);

        const context = (history || [])
            .filter(m => m.mensaje_texto) // Filtrar mensajes sin texto (imágenes, audios, etc)
            .reverse()
            .map(m => ({
                role: m.es_mio ? "assistant" : "user",
                content: m.mensaje_texto
            }));

        // 3. Buscar en memoria_bot
        const words = msg.mensaje_texto.split(' ').filter(w => w.length > 3);
        const { data: knowledge } = await supabase
                .from('memoria_bot')
                .select('contenido')
                .or(words.map(w => `contenido.ilike.%${w}%`).join(','));

        let brain = "";
        if (knowledge && knowledge.length > 0) {
            brain = "\n\nInformación base encontrada en BD:\n" + knowledge.map(k => "- " + k.contenido).join('\n');
        }

        const systemPrompt = (perfil.prompt_sistema || "Eres un asistente de ventas.") + brain;

        try {
            const aiResponse = await getDeepSeekResponse(systemPrompt, context);
            if (aiResponse) {
                console.log(`AI dice: ${aiResponse}`);
                const sent = await sendWhatsAppMessage(instanceName, remoteJid, aiResponse);
                if (sent) {
                    await supabase.from('mensajes_wa').insert({
                        perfil_id: perfil.id,
                        remote_jid: remoteJid,
                        nombre_contacto: 'IA Bot (Retroactivo)',
                        mensaje_texto: aiResponse,
                        es_mio: true
                    });
                    console.log(`✅ Respondido exitosamente a ${remoteJid}`);
                }
            }
        } catch (err) {
            console.error(`Error con AI para ${remoteJid}:`, err.message);
        }
    }
}

processPending();
