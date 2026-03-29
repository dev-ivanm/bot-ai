const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { getDeepSeekResponse, analyzeConversation } = require('../services/deepseek');
require('dotenv').config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Soporte para /evolution y /evolution/event-name (para evitar 404s en versiones que agregan el evento a la URL)
router.post(['/evolution', '/evolution/:eventPath'], async (req, res) => {
    try {
        const eventFromPath = req.params.eventPath ? req.params.eventPath.toUpperCase().replace(/-/g, '_') : null;
        const bodyEvent = req.body.event ? req.body.event.toUpperCase() : '';
        const event = bodyEvent || eventFromPath || '';
        
        console.log(`[Webhook] Recibido evento: ${event} (Ruta: ${req.originalUrl})`);
        
        // Respondemos 200 rápido a Evolution para que no reintente la entrega
        res.status(200).send('OK');

        // Procesar asíncronamente
        if (event) {
            handleWebhookEvent({ ...req.body, event }, req).catch(console.error);
        }
        
    } catch (error) {
        console.error("Error en Webhook:", error);
        if (!res.headersSent) res.status(500).send("Error");
    }
});

async function handleWebhookEvent(body, req) {
    let event = body.event || '';
    // Estandarizar nombres de eventos (algunos vienen con puntos, otros con guiones bajos)
    event = event.toUpperCase().replace(/\./g, '_').replace(/-/g, '_');
    
    const instanceName = body.instance;
    const data = body.data;

    // Solo procesar si hay datos
    if (!data || Object.keys(data).length === 0) return;

    console.log(`[Webhook] Procesando evento: ${event} para ${instanceName}`);

    switch (event) {
        case 'MESSAGES.UPSERT':
        case 'MESSAGES_UPSERT':
            await handleMessagesUpsert(instanceName, data, req);
            break;
        case 'MESSAGES_SET':
            if (req.io) req.io.emit('messages_set', { instance: instanceName, data });
            break;
        case 'MESSAGES_UPDATE':
            if (req.io) req.io.emit('message_update', { instance: instanceName, data });
            break;
        case 'PRESENCE_UPDATE':
            if (req.io) req.io.emit('presence_update', { instance: instanceName, data });
            break;
        case 'CHATS_UPDATE':
        case 'CHATS_UPSERT':
        case 'CHATS_SET':
            if (req.io) req.io.emit('chats_update', { instance: instanceName, data });
            break;
        case 'CHATS_DELETE':
            if (req.io) req.io.emit('chat_delete', { instance: instanceName, data });
            break;
        case 'CONTACTS_UPDATE':
        case 'CONTACTS_UPSERT':
        case 'CONTACTS_SET':
            if (req.io) req.io.emit('contacts_update', { instance: instanceName, data });
            break;
        case 'CALL':
            if (req.io) req.io.emit('incoming_call', { instance: instanceName, data });
            break;
        default:
            console.log(`[Webhook] Evento no manejado específicamente:`, event);
    }
}

async function handleMessagesUpsert(instanceName, messageData, req) {
    console.log(`[Webhook] handleMessagesUpsert for ${instanceName}. fromMe: ${messageData.key?.fromMe}. Data sample:`, JSON.stringify(messageData).substring(0, 300));
    
    // Obtenemos de quién vino el mensaje (numero)
    const remoteJid = messageData.key?.remoteJid;
    const isFromMe = messageData.key?.fromMe;

    // Emitir mensaje recibido al frontend vía Socket.io
    if (req.io && remoteJid) {
        const content = messageData.message?.message || messageData.message || {};
        const payloadMsg = {
            id: messageData.key?.id || Date.now().toString(),
            fromMe: isFromMe,
            sender: messageData.pushName || (isFromMe ? 'Tú' : ''),
            text: content.conversation || 
                  content.extendedTextMessage?.text || 
                  content.imageMessage?.caption || 
                  content.videoMessage?.caption || "Mensaje multimedia",
            timestamp: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
            remoteJid: remoteJid
        };
        req.io.emit('new_message', { instance: instanceName, message: payloadMsg });
    }
    
    // Solo la IA responde a mensajes entrantes que NO vienen de nosotros mismos
    if (isFromMe || !remoteJid) {
        console.log(`[Webhook] Ignorando mensaje (isFromMe: ${isFromMe}, remoteJid: ${remoteJid})`);
        return;
    }

    const content = messageData.message?.message || messageData.message || {};
    const text = content.conversation || 
                 content.extendedTextMessage?.text || 
                 content.imageMessage?.caption || 
                 content.videoMessage?.caption || 
                 "";

    if (!text) {
        console.log(`[Webhook] Mensaje sin texto detectable para IA en ${instanceName}`);
        return;
    }

    console.log(`[Webhook] Procesando mensaje de ${remoteJid} en ${instanceName}: "${text.substring(0, 50)}..."`);

    // 2. Buscar en Supabase el perfil asociado a esta instancia
    const { data: perfil, error } = await supabase
        .from('perfiles_bot')
        .select('*')
        .eq('instance_name', instanceName)
        .single();
        
    if (error || !perfil) {
        const { data: allProfiles } = await supabase.from('perfiles_bot').select('instance_name');
        console.log(`[Webhook] ❌ ERROR: No se encontró perfil para la instancia "${instanceName}".`);
        console.log(`[Webhook] Instancias disponibles en DB: ${allProfiles?.map(p => `"${p.instance_name}"`).join(', ') || 'NINGUNA'}`);
        return;
    }
    console.log(`[Webhook] Perfil encontrado para ${instanceName} (ID: ${perfil.id})`);

    // --- NUEVO: Verificar si el plan de la empresa ha expirado ---
    const { data: userProfile } = await supabase
        .from('perfiles_usuario')
        .select('empresa_id')
        .eq('id', perfil.id)
        .single();
    
    let isPlanExpired = false;
    if (userProfile?.empresa_id) {
        const { data: empresa } = await supabase
            .from('empresas')
            .select('vencimiento_plan, plan')
            .eq('id', userProfile.empresa_id)
            .single();
        
        if (empresa?.vencimiento_plan && empresa.plan !== 'gratis') {
            isPlanExpired = new Date(empresa.vencimiento_plan) < new Date();
        }
    }

    if (isPlanExpired) {
        console.log(`[Webhook] ⚠️ PLAN EXPIRADO para ${instanceName}. Usando solo personalidad (sin cerebro).`);
    }

    // 2.5 Guardar mensaje entrante en mensajes_wa para permanencia

    try {
        await supabase.from('mensajes_wa').insert({
            perfil_id: perfil.id,
            remote_jid: remoteJid,
            nombre_contacto: messageData.pushName || "",
            mensaje_texto: text,
            es_mio: false,
            created_at: new Date()
        });
        console.log(`[Webhook] Mensaje entrante guardado en Supabase (mensajes_wa) for ${instanceName}`);
    } catch (dbErr) {
        console.error(`[Webhook] Error al guardar en Supabase (mensajes_wa):`, dbErr);
    }
    
    // 3. Obtener el prompt del usuario (Tenant) y CONTEXTO de la conversación
    const systemPrompt = perfil.prompt_sistema || "Eres un asistente virtual útil.";
    console.log(`[Webhook] [DEBUG-AI] Prompt detectado en DB: "${systemPrompt}"`);

    try {
        // --- NUEVO: Obtener contexto de los últimos 20 mensajes ---
        const { data: history } = await supabase
            .from('mensajes_wa')
            .select('mensaje_texto, es_mio')
            .eq('remote_jid', remoteJid)
            .order('created_at', { ascending: false })
            .limit(20);

        const conversationContext = (history || [])
            .reverse()
            .map(m => ({
                role: m.es_mio ? "assistant" : "user",
                content: m.mensaje_texto
            }));

        // --- NUEVO: Buscar conocimiento en memoria_bot (El "Cerebro") ---
        // SOLO si el plan NO ha expirado
        let knowledgeText = "";
        const words = text
            .split(' ')
            .map(w => w.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, ''))
            .filter(w => w.length > 3);
        
        if (!isPlanExpired && words.length > 0) {

            const { data: knowledge, error: knowledgeErr } = await supabase
                .from('memoria_bot')
                .select('contenido')
                .eq('user_id', perfil.id) // Filtrar por el dueño de esta instancia
                .or(words.map(w => `contenido.ilike.%${w}%`).join(','))
                .limit(5);

            if (knowledgeErr) {
                console.error(`[Webhook] Error buscando memoria:`, knowledgeErr);
            }

            if (knowledge && knowledge.length > 0) {
                knowledgeText = "\n\n[INFORMACIÓN DE BASE DE DATOS PARA ESTA PREGUNTA]:\n" + 
                                knowledge.map(k => "- " + k.contenido).join('\n') + "\n\n[FIN DE INFORMACIÓN EXTRA]";
                console.log(`[Webhook] Encontrados ${knowledge.length} fragmentos de conocimiento`);
            }
        }

        const finalSystemPrompt = systemPrompt + knowledgeText;

        // Añadimos el mensaje actual si no está en el historial (por si el insert de arriba tardó)
        if (conversationContext.length === 0 || conversationContext[conversationContext.length - 1].content !== text) {
            conversationContext.push({ role: "user", content: text });
        }

        // 4. Llamar a DeepSeek (vía Gemini ahora)
        console.log(`[Webhook] [DEBUG-AI] Prompt Final (primeros 100): "${finalSystemPrompt.substring(0, 100)}..."`);
        console.log(`[Webhook] [DEBUG-AI] Llamando a AI-Service con ${conversationContext.length} mensajes de contexto.`);
        const aiResponse = await getDeepSeekResponse(finalSystemPrompt, conversationContext);
        
        if (!aiResponse) {
            console.log(`[Webhook] [DEBUG-AI] ⚠️ GEMINI NO DEVOLVIÓ NADA.`);
            return;
        }
        
        console.log(`[Webhook] [DEBUG-AI] ✅ GEMINI RESPONDIÓ: "${aiResponse.substring(0, 100)}..."`);

        // 5. Enviar respuesta por WhatsApp vía Evolution API
        console.log(`[Webhook] [DEBUG-AI] INTENTANDO ENVIAR A WHATSAPP: ${remoteJid}...`);
        await sendWhatsAppMessage(instanceName, remoteJid, aiResponse);
        console.log(`[Webhook] Proceso de envío completado para ${instanceName}`);

        // 6. Guardar la respuesta del Bot en mensajes_wa para permanencia
        await supabase.from('mensajes_wa').insert({
            perfil_id: perfil.id,
            remote_jid: remoteJid,
            nombre_contacto: 'IA Bot',
            mensaje_texto: aiResponse,
            es_mio: true,
            created_at: new Date()
        });
        console.log(`[Webhook] Respuesta IA persistida y enviada para ${instanceName}`);

        // 7. Emitir la respuesta del Bot vía Socket.io
        if (req.io) {
            const botPayload = {
                id: 'ai-' + Date.now(),
                fromMe: true,
                sender: 'Bot',
                text: aiResponse,
                timestamp: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
                remoteJid: remoteJid
            };
            req.io.emit('new_message', { instance: instanceName, message: botPayload });
        }
        // 8. Análisis de LEAD en segundo plano (para no retrasar la respuesta)
        console.log(`[Webhook] Iniciando análisis de Lead para ${remoteJid}...`);
        analyzeConversation(conversationContext)
            .then(async (metrics) => {
                if (metrics) {
                    console.log(`[Webhook] Métricas extraídas:`, metrics);
                    
                    // Obtener empresa_id del perfiles_usuario asociado al bot
                    const { data: userProfile } = await supabase
                        .from('perfiles_usuario')
                        .select('empresa_id')
                        .eq('id', perfil.id)
                        .single();

                    const leadData = {
                        telefono: remoteJid,
                        nombre: metrics.nombre !== "Desconocido" ? metrics.nombre : (nombre_contacto || remoteJid.split('@')[0]),
                        estado: metrics.estado,
                        probabilidad_compra: metrics.probabilidad_compra,
                        nivel_satisfaccion: metrics.nivel_satisfaccion,
                        sentimiento_actual: `IA: ${metrics.estado}`,
                        resumen_interes: metrics.resumen_interes,
                        ultimo_contacto: new Date(),
                        agente_id: perfil.id,
                        empresa_id: userProfile?.empresa_id || null
                    };

                    // Buscamos si el lead ya existe para este teléfono
                    const { data: existingLead } = await supabase
                        .from('leads')
                        .select('id')
                        .eq('telefono', remoteJid)
                        .maybeSingle();

                    let leadErr;
                    if (existingLead) {
                        // Actualizar existente
                        const { error } = await supabase
                            .from('leads')
                            .update(leadData)
                            .eq('id', existingLead.id);
                        leadErr = error;
                    } else {
                        // Insertar nuevo
                        const { error } = await supabase
                            .from('leads')
                            .insert(leadData);
                        leadErr = error;
                    }

                    if (leadErr) console.error(`[Webhook] Error al actualizar Lead:`, leadErr);
                    else console.log(`[Webhook] Lead actualizado exitosamente para ${remoteJid}`);
                }
            })
            .catch(err => console.error(`[Webhook] Error en análisis de lead:`, err));

    } catch (err) {
        console.error(`[Webhook] ERROR CRÍTICO en flujo de IA para ${instanceName}:`, err);
    }
}

async function sendWhatsAppMessage(instanceName, number, text) {
    try {
        const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
        console.log(`[Webhook] Enviando a URL: ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: number,
                text: text,
                delay: 1500 // Pequeño retraso para naturalidad
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Webhook] ERROR Evolution API (${response.status}): ${errText}`);
        } else {
             console.log(`[Webhook] ✅ Mensaje enviado exitosamente a WhatsApp (${number})`);
        }
    } catch (error) {
        console.error(`[Webhook] Excepción al enviar mensaje:`, error);
    }
}

module.exports = router;
