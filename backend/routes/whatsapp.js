const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const { scoreLead } = require('../services/leadScorer');
const { canAccess: checkPlan } = require('../services/planConfig');

// Middleware: Verifica si el plan de la empresa permite una feature y si no ha expirado
async function checkPlanAccess(feature, userId) {
    if (!userId) return false;
    const { data: user } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', userId).single();
    if (!user?.empresa_id) return true; // Sin empresa = acceso libre (legacy)
    
    const { data: empresa } = await supabase.from('empresas').select('plan, vencimiento_plan').eq('id', user.empresa_id).single();
    
    // Verificar si el plan ha expirado (solo para planes que no sean 'gratis')
    if (empresa?.plan !== 'gratis' && empresa?.vencimiento_plan) {
        if (new Date(empresa.vencimiento_plan) < new Date()) {
            // Si el plan expiró, solo permitimos 'chats' (y 'upgrade'/'profile' que no pasan por aquí usualmente)
            if (feature === 'chats') return true;
            return false; // Plan expirado para cualquier otra feature
        }
    }
    
    return checkPlan(empresa?.plan, feature);
}

// Configuración de Multer para subidas temporales
const upload = multer({ dest: 'uploads/' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// POST /api/whatsapp/instance/create
router.post('/instance/create', async (req, res) => {
    try {
        const { instanceName, integration, qrcode } = req.body;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                instanceName,
                integration: integration || "WHATSAPP-BAILEYS",
                qrcode: qrcode !== undefined ? qrcode : true,
                // Propiedades mandatorias en raíz
                rejectCall: false,
                groupsIgnore: false,
                alwaysOnline: false,
                readMessages: true,
                readStatus: true,
                syncFullHistory: true,
                // También en sub-objeto settings por si acaso
                settings: {
                    rejectCall: false,
                    groupsIgnore: false,
                    alwaysOnline: false,
                    readMessages: true,
                    readStatus: true,
                    syncFullHistory: true
                }
            })
        });

        const data = await response.json();
        
        // Si ya existe o si se creó bien, configuramos/actualizamos el webhook y los settings
        if (response.ok || (response.status === 403 && data?.response?.message?.[0]?.includes("already in use"))) {
            console.log(`[Backend] Instance ${instanceName} valid, configuring triggers...`);
            await setupWebhook(instanceName);
            
            if (!response.ok) {
                return res.status(200).json({ message: "Instance updated and triggers configured", instance: { instanceName } });
            }
        }

        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error creating instance:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/whatsapp/instance/connect/:instanceName
router.get('/instance/connect/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        const data = await response.json();


        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error getting QR:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/whatsapp/instance/setup-webhook/:instanceName
router.post('/instance/setup-webhook/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        await setupWebhook(instanceName);
        res.json({ message: "Webhook setup triggered" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/whatsapp/instance/logout/:instanceName
router.delete('/instance/logout/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        
        // 1. First logout to disconnect the session
        const logoutResponse = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        // 2. Then delete the instance entirely from Evolution API
        const deleteResponse = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        // We return the delete response status, as the logout might fail if it's already disconnected
        res.status(deleteResponse.status).json(await deleteResponse.json().catch(() => ({})));
    } catch (error) {
        console.error("Error logging out and deleting instance:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// DELETE /api/whatsapp/instance/delete/:instanceName
router.delete('/instance/delete/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        res.status(response.status).json(await response.json().catch(() => ({})));
    } catch (error) {
        console.error("Error deleting instance:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/whatsapp/chat/findChat/:instanceName
router.post('/chat/findChat/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        
        const response = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${instanceName}`, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        const data = await response.json();
        const parsedData = Array.isArray(data) ? data : (data.chats || data.data || []);
        
        let formattedChats = [];
        if (Array.isArray(parsedData)) {
            // Helper: extract readable name from JID (e.g. "584241499862@s.whatsapp.net" -> "+584241499862")
            const extractName = (jid) => {
                if (!jid) return 'Desconocido';
                const num = jid.split('@')[0];
                return num ? `+${num}` : 'Desconocido';
            };

            // Filter out status broadcasts, @lid entries, and group chats
            const filtered = parsedData.filter(chat => {
                const jid = chat.remoteJid || chat.id || '';
                return !jid.includes('status@broadcast') && 
                       !jid.endsWith('@lid') &&
                       !jid.endsWith('@g.us');
            });

            // Map the Evolution API response to what Dashboard.tsx expects
            const enrichedChats = await Promise.all(filtered.map(async chat => {
                const jid = chat.remoteJid || chat.id || '';
                
                // 1. Prioritize authentic names from Evolution
                let contactName = chat.pushName || chat.push_name || chat.name || chat.lastMessage?.pushName || '';
                
                // 2. Fallback: Search in Supabase messages_wa for this JID
                if (!contactName || contactName.toLowerCase() === 'você' || contactName.toLowerCase() === 'voce' || contactName === extractName(jid)) {
                    try {
                        const { data: latestMsg } = await supabase
                            .from('mensajes_wa')
                            .select('nombre_contacto')
                            .eq('remote_jid', jid)
                            .not('nombre_contacto', 'is', null)
                            .neq('nombre_contacto', '')
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (latestMsg?.nombre_contacto) {
                            contactName = latestMsg.nombre_contacto;
                            console.log(`[findChat] Name enriched from Supabase for ${jid}: ${contactName}`);
                        }
                    } catch (err) {
                        console.error(`[findChat] Error fetching name from Supabase for ${jid}:`, err);
                    }
                }

                if (!contactName || contactName.toLowerCase() === 'você' || contactName.toLowerCase() === 'voce') {
                    contactName = extractName(jid);
                }

                // Extracción de último mensaje robusta para Evolution API v2
                const lastMsg = chat.lastMessage || {};
                const mType = lastMsg.messageType || "";
                const content = lastMsg.message || {};
                
                let lastText = "";
                
                if (content.conversation) {
                    lastText = content.conversation;
                } else if (content.extendedTextMessage?.text) {
                    lastText = content.extendedTextMessage.text;
                } else if (content.imageMessage?.caption || content.videoMessage?.caption) {
                    lastText = content.imageMessage?.caption || content.videoMessage?.caption;
                } else if (mType === 'audioMessage') {
                    lastText = "🎵 Audio";
                } else if (mType === 'imageMessage') {
                    lastText = "📷 Imagen";
                } else if (mType === 'videoMessage') {
                    lastText = "🎥 Video";
                } else if (mType === 'documentMessage') {
                    lastText = "📄 Documento";
                } else if (typeof lastMsg.content === 'string') {
                    lastText = lastMsg.content;
                } else {
                    lastText = "Mensaje multimedia";
                }

                return {
                    id: jid,
                    contact: {
                        name: contactName
                    },
                    lastMessage: {
                        message: {
                             conversation: lastText
                        },
                        timestamp: lastMsg.messageTimestamp
                    }
                };
            }));
            formattedChats = enrichedChats;
        } 
        
        res.status(response.status).json(formattedChats);
    } catch (error) {
        console.error("Error finding chats:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/whatsapp/chat/findMessages/:instanceName
router.post('/chat/findMessages/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        const { remoteJid } = req.body.where?.key || req.body;

        if (!remoteJid) {
            return res.status(400).json({ error: "remoteJid is required" });
        }

        const normalizedJid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
        console.log(`[findMessages] Dual fetch for ${normalizedJid} on ${instanceName}`);
        
        // 1. Obtener perfil para ID de usuario
        const { data: perfil } = await supabase
            .from('perfiles_bot')
            .select('id')
            .eq('instance_name', instanceName)
            .single();

        // 2. Fetch paralelo (Evo API + Supabase)
        const [evoRes, supaRes] = await Promise.all([
            fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                body: JSON.stringify({
                    where: { key: { remoteJid: normalizedJid } },
                    orderBy: { messageTimestamp: 'desc' },
                    limit: 50
                })
            }).then(r => r.json()).catch(e => { console.error("Evo fetch error:", e); return []; }),
            perfil ? supabase
                .from('mensajes_wa')
                .select('*')
                .eq('perfil_id', perfil.id)
                .eq('remote_jid', normalizedJid)
                .order('created_at', { ascending: false })
                .limit(50)
            : Promise.resolve({ data: [] })
        ]);

        const rawEvoMessages = Array.isArray(evoRes) ? evoRes : (evoRes.messages?.records || evoRes.messages || []);
        const rawSupaMessages = supaRes.data || [];
        const seenIds = new Set();
        const formattedMessages = [];

        // Procesar Evolution API
        for (const msg of rawEvoMessages) {
            const id = msg.key?.id || msg.id;
            if (id && seenIds.has(id)) continue;
            if (id) seenIds.add(id);

            const content = msg.message?.message || msg.message || {};
            const text = content.conversation || 
                         content.extendedTextMessage?.text ||
                         content.imageMessage?.caption ||
                         (msg.messageType || 'Mensaje');

            formattedMessages.push({
                id: id || `evo-${Date.now()}`,
                fromMe: msg.key?.fromMe ?? msg.fromMe ?? false,
                sender: msg.pushName || (msg.key?.fromMe ? 'Tú' : ''),
                text: text || '',
                timestamp: msg.messageTimestamp 
                    ? new Date(Number(msg.messageTimestamp) * 1000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) 
                    : '',
                rawTimestamp: Number(msg.messageTimestamp || 0)
            });
        }

        // Procesar Supabase (Evitar duplicados fuzzy)
        for (const msg of rawSupaMessages) {
            const isDuplicate = formattedMessages.some(m => 
                m.text === msg.mensaje_texto && 
                Math.abs(new Date(m.rawTimestamp * 1000).getTime() - new Date(msg.created_at).getTime()) < 20000
            );

            if (!isDuplicate) {
                formattedMessages.push({
                    id: `supa-${msg.id}`,
                    fromMe: msg.es_mio,
                    sender: msg.es_mio ? 'Sistema' : (msg.nombre_contacto || ''),
                    text: msg.mensaje_texto,
                    timestamp: new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
                    rawTimestamp: Math.floor(new Date(msg.created_at).getTime() / 1000)
                });
            }
        }

        formattedMessages.sort((a, b) => a.rawTimestamp - b.rawTimestamp);
        res.status(200).json(formattedMessages);
    } catch (error) {
        console.error("Error finding messages:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// --- GESTIÓN DE PERFILES (Evita 403 Forbidden de RLS) ---

// GET /api/whatsapp/profile/me?userId=...
router.get('/profile/me', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId es requerido' });

    try {
        const { data: profile, error: pError } = await supabase
            .from('perfiles_usuario')
            .select('*')
            .eq('id', userId)
            .single();

        if (pError) throw pError;

        // Datos de la empresa asociada (incluyendo el plan y vencimiento corregido para la UI)
        let empresaData = null;
        if (profile.empresa_id) {
            // Seleccionamos todo (*) para evitar que el query falle si falta alguna columna nueva (como is_trial)
            const { data: empresa, error: eError } = await supabase
                .from('empresas')
                .select('*')
                .eq('id', profile.empresa_id)
                .single();
            
            if (eError) {
                console.error('[Profile] Error fetching empresa:', eError.message);
                // Fallback: si falla por selects específicos o RLS, intentar al menos traer lo básico
                const { data: basic } = await supabase.from('empresas').select('plan, nombre').eq('id', profile.empresa_id).single();
                empresaData = basic || null;
            } else {
                empresaData = empresa;
            }
        }

        // Plan expirado solo si tiene fecha y es pasada
        const isExpired = (empresaData?.vencimiento_plan && empresaData.vencimiento_plan !== null) 
            ? new Date(empresaData.vencimiento_plan) < new Date() 
            : false;

        res.json({
            profile,
            empresa: empresaData,
            isPlanExpired: !!isExpired && empresaData?.plan !== 'gratis'
        });
    } catch (err) {
        console.error('[Profile] Error fetching me:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/whatsapp/profile/:userId
router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('perfiles_bot')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/whatsapp/profile
router.post('/profile', async (req, res) => {
    try {
        const { id, email, prompt_sistema, instance_name } = req.body;
        
        if (!id) return res.status(400).json({ error: "id is required" });

        const { data, error } = await supabase
            .from('perfiles_bot')
            .upsert({
                id,
                email,
                prompt_sistema,
                instance_name
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ error: error.message });
    }
});
// --- GESTIÓN DE USO Y LÍMITES (Consolidado) ---

// GET /api/whatsapp/usage?userId=xxx
router.get('/usage', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId es requerido' });

    try {
        // 1. Obtener empresa_id del usuario
        const { data: userProfile, error: pError } = await supabase
            .from('perfiles_usuario')
            .select('empresa_id')
            .eq('id', userId)
            .single();

        if (pError || !userProfile?.empresa_id) {
            return res.json({ agentes: 1, memoria: 0, documentos: 0 });
        }

        const empresaId = userProfile.empresa_id;

        // 2. Obtener todos los agentes de esa empresa para contar su memoria total
        const { data: employees } = await supabase.from('perfiles_usuario').select('id').eq('empresa_id', empresaId);
        const userIds = employees?.map(e => e.id) || [];

        if (userIds.length === 0) {
            return res.json({ agentes: 1, memoria: 0, documentos: 0 });
        }

        // 3. Ejecutar conteos en paralelo
        const [agentesCount, allMemRes] = await Promise.all([
            supabase.from('perfiles_usuario').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId),
            supabase.from('memoria_bot').select('contenido').in('user_id', userIds)
        ]);

        res.json({
            agentes: agentesCount.count || 1,
            documentos: 0,
            memoria: totalMemoria.length
        });
    } catch (err) {
        console.error('[Usage] Error calculando uso:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- GESTIÓN DE MEMORIA (Cerebro de la IA) ---

// GET /api/whatsapp/memory?userId=...
router.get('/memory', async (req, res) => {
    try {
        const { userId } = req.query;
        console.log(`[Memory Leak Debug] GET /memory requested for userId: ${userId}`);
        
        if (!userId) return res.status(400).json({ error: "userId is required" });

        const { data, error } = await supabase
            .from('memoria_bot')
            .select('*')
            .eq('user_id', userId)
            .not('user_id', 'is', null);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error("Error fetching memory:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/whatsapp/memory
router.post('/memory', async (req, res) => {
    try {
        const { contenido, userId } = req.body;
        if (!contenido || !userId) {
            return res.status(400).json({ error: "Contenido y userId son requeridos" });
        }

        const { data, error } = await supabase
            .from('memoria_bot')
            .insert({ contenido, user_id: userId })
            .select()
            .single();

        if (error) throw error;
        if (req.io) req.io.emit('memory_updated', { userId });
        res.json(data);
    } catch (error) {
        console.error("Error adding memory:", error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/whatsapp/memory/:id?userId=...
router.delete('/memory/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;
        
        if (!userId) return res.status(400).json({ error: "userId is required" });

        const { error } = await supabase
            .from('memoria_bot')
            .delete()
            .eq('id', id)
            .eq('user_id', userId); // Solo borrar si le pertenece

        if (error) throw error;
        if (req.io) req.io.emit('memory_updated', { userId });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting memory:", error);
        res.status(500).json({ error: error.message });
    }
});


// POST /api/whatsapp/message/sendText/:instanceName
router.post('/message/sendText/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        const { number, text } = req.body;

        if (!number || !text) {
            return res.status(400).json({ error: "number and text are required" });
        }

        console.log(`[sendText] Sending message to ${number} on ${instanceName}`);
        
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number,
                text,
                delay: 1000
            })
        });

        const data = await response.json();

        // 🟢 Guardar en Supabase para persistencia definitiva
        try {
            const { data: perfil } = await supabase
                .from('perfiles_bot')
                .select('id')
                .eq('instance_name', instanceName)
                .single();

            if (perfil) {
                await supabase.from('mensajes_wa').insert({
                    perfil_id: perfil.id,
                    remote_jid: number.includes('@') ? number : `${number}@s.whatsapp.net`,
                    mensaje_texto: text,
                    es_mio: true,
                    created_at: new Date()
                });
                console.log(`[sendText] Mensaje manual persistido en Supabase (mensajes_wa) para ${instanceName}`);
            }
        } catch (dbErr) {
            console.error(`[sendText] Error al persistir en Supabase:`, dbErr);
        }

        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/whatsapp/webhook/set/:instanceName
router.post('/webhook/set/:instanceName', async (req, res) => {
    try {
        const { instanceName } = req.params;
        const { url, enabled, events } = req.body;

        const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                webhook: {
                    enabled: enabled !== undefined ? enabled : true,
                    url: url,
                    webhook_by_events: false,
                    webhook_base64: false,
                    events: events || [
                        "MESSAGES_UPSERT",
                        "CONTACTS_UPSERT"
                    ]
                }
            })
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error setting webhook:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/whatsapp/instance/setup-webhook/:instanceName

// Helper function to setup webhook and settings
// Helper function to setup webhook and settings
async function setupWebhook(instanceName) {
    try {
        // 1. Configurar Webhook con eventos completos
        // El endpoint /webhook/set/:instanceName espera un objeto con la propiedad "webhook"
        let webhookUrl = 'http://backend:3000/api/webhook/evolution';
        const webhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                webhook: {
                    enabled: true,
                    url: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/webhook/evolution` : webhookUrl,
                    webhook_by_events: false,
                    webhook_base64: false,
                    events: [
                        "MESSAGES_UPSERT",
                        "MESSAGES_SET",
                        "MESSAGES_UPDATE",
                        "MESSAGES_DELETE",
                        "SEND_MESSAGE",
                        "CONNECTION_UPDATE",
                        "PRESENCE_UPDATE",
                        "CHATS_UPDATE",
                        "CHATS_SET",
                        "CHATS_UPSERT",
                        "CONTACTS_UPDATE",
                        "CONTACTS_SET",
                        "CONTACTS_UPSERT",
                        "CALL"
                    ]
                }
            })
        });

        console.log(`[Webhook Setup] Result for ${instanceName}:`, await webhookResponse.text());

        // 2. Configurar Settings (Persistencia y WebSocket)
        // El endpoint /settings/set/:instanceName espera las propiedades DIRECTAMENTE en el body (o como subobjeto segun version)
        // Para v2 de EvoApiCloud, mandamos las propiedades en la RAIZ del body de este endpoint.
        const settingsResponse = await fetch(`${EVOLUTION_API_URL}/settings/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                rejectCall: false,
                groupsIgnore: false,
                alwaysOnline: false,
                readMessages: true,
                readStatus: true,
                syncFullHistory: true,
                database: {
                    persist: true,
                    save_data_instance: true,
                    save_data_new_message: true,
                    save_data_message: true,
                    save_data_messages: true,
                    save_data_messages_upsert: true,
                    save_data_messages_update: true,
                    save_data_messages_delete: true,
                    save_data_messages_set: true,
                    save_data_messages_send: true,
                    save_data_messages_receive: true,
                    save_data_contacts: true,
                    save_data_chats: true,
                    save_data_chats_upsert: true,
                    save_data_chats_update: true,
                    save_data_chats_set: true,
                    save_data_sync: true,
                    save_data_syncs: true
                },
                websocket: {
                    enabled: true,
                    events: [
                        "MESSAGES_UPSERT",
                        "MESSAGES_SET",
                        "MESSAGES_UPDATE",
                        "MESSAGES_DELETE",
                        "SEND_MESSAGE",
                        "CONNECTION_UPDATE",
                        "PRESENCE_UPDATE",
                        "CHATS_UPDATE",
                        "CHATS_SET",
                        "CHATS_UPSERT",
                        "CONTACTS_UPDATE",
                        "CONTACTS_SET",
                        "CONTACTS_UPSERT",
                        "CALL"
                    ]
                }
            })
        });
        
        console.log(`[Settings Setup] Result for ${instanceName}:`, await settingsResponse.text());

    } catch (error) {
        console.error("Error in setupWebhook:", error);
    }
}

// POST /api/whatsapp/admin/create-user
// Endpoint administrativo para que el super-admin o dueño cree agentes
router.post('/admin/create-user', async (req, res) => {
    const { email, password, role, is_owner } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // 1. Verificar Cuota de Agentes (solo si se pasa un userId del creador)
        const { creatorUserId } = req.body; 
        if (creatorUserId) {
            const { data: creator } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', creatorUserId).single();
            if (creator?.empresa_id) {
                const { data: countData } = await supabase.from('perfiles_usuario').select('id', { count: 'exact' }).eq('empresa_id', creator.empresa_id);
                const { data: empresa } = await supabase.from('empresas').select('limite_agentes').eq('id', creator.empresa_id).single();
                
                if (countData.length >= (empresa?.limite_agentes || 0)) {
                    return res.status(403).json({ error: 'Has alcanzado el límite de agentes para tu plan' });
                }
            }
        }

        // 2. Obtener empresaId del creador para vincular al nuevo agente
        const { data: creator } = await supabase.from('perfiles_usuario').select('empresa_id, role, is_owner').eq('id', creatorUserId).single();
        const empresaId = creator?.empresa_id;

        // Validación de seguridad para la jerarquía: solo un super-admin o un dueño pueden crear agentes
        if (creator?.role !== 'super-admin' && !creator?.is_owner) {
            return res.status(403).json({ error: 'No tienes permisos para crear agentes' });
        }

        // Validación de seguridad para la jerarquía: solo un super-admin puede crear dueños directamente o forzar is_owner=true
        const finalIsOwner = creator?.role === 'super-admin' ? Boolean(is_owner) : false;

        // 3. Creamos el usuario en Supabase Auth
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { 
                role: role || 'agente',
                empresa_id: empresaId,
                is_owner: finalIsOwner
            }
        });

        if (error) {
            console.error('[Backend] Error creating user:', error);
            return res.status(status(error.status) || 500).json({ error: error.message });
        }

        // El trigger handle_new_user en Supabase se encargará de crear el perfil en perfiles_usuario
        res.status(201).json({ user: data.user });
    } catch (err) {
        console.error('[Backend] Internal error creating user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/whatsapp/admin/delete-user/:id
router.delete('/admin/delete-user/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        console.log(`[Backend] Intentando eliminar usuario: ${id}`);

        // 1. Limpieza manual de datos dependientes PRIMERO
        // Esto es necesario porque perfiles_usuario y perfiles_bot tienen llaves foráneas 
        // hacia auth.users y bloquean el borrado si no se eliminan primero.
        console.log(`[Backend] Limpiando datos de tablas públicas para: ${id}`);
        await Promise.all([
            supabase.from('perfiles_usuario').delete().eq('id', id),
            supabase.from('perfiles_bot').delete().eq('id', id),
            supabase.from('memoria_bot').delete().eq('user_id', id),
            supabase.from('mensajes_wa').delete().eq('perfil_id', id)
        ]);

        // 2. Ahora que no hay dependencias, eliminar de Supabase Auth
        console.log(`[Backend] Eliminando usuario de Auth: ${id}`);
        const { error: authError } = await supabase.auth.admin.deleteUser(id);

        if (authError) {
            console.error('[Backend] Error eliminando de Auth:', authError);
            return res.status(500).json({ error: authError.message });
        }

        res.json({ success: true, message: 'Usuario y todos sus datos asociados han sido eliminados' });
    } catch (err) {
        console.error('[Backend] Error interno al eliminar usuario:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/whatsapp/admin/leads
// Lista los leads con sus puntajes de la empresa del usuario
router.get('/admin/leads', async (req, res) => {
    const { userId } = req.query; // Para filtrar por empresa si no usamos middleware de sesión completo aquí

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    try {
        // Obtenemos empresa_id
        const { data: user } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', userId).single();
        const empresaId = user?.empresa_id;

        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('probabilidad_compra', { ascending: false });

        if (error) throw error;
        res.json(leads);
    } catch (err) {
        console.error('[Backend] Error listando leads:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// POST /api/whatsapp/admin/leads/score/:id
// Dispara el análisis manual de un lead
router.post('/admin/leads/score/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await scoreLead(id);
        res.json({ success: true, result });
    } catch (err) {
        console.error('[Backend] Error analizando lead:', err);
        res.status(500).json({ error: err.message });
    }
});

function status(s) {
    return s;
}

// =============================================
// FASE 5: CAMPAÑAS DE MARKETING & HISTORIAL
// =============================================

const { executeAICampaign } = require('../services/campaignService');

// POST /api/whatsapp/admin/campaign/send
// Crea y ejecuta una campaña de marketing con IA
router.post('/admin/campaign/send', async (req, res) => {
    const { userId, leadIds, nombre, objetivo, mensajeTemplate } = req.body;

    if (!userId || !leadIds || leadIds.length === 0) {
        return res.status(400).json({ error: 'userId y leadIds son requeridos' });
    }

    try {
        // Obtener empresa_id del usuario
        const { data: user } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', userId).single();

        // Crear la campaña en la base de datos
        const { data: campaign, error: campError } = await supabase
            .from('campanas')
            .insert({
                empresa_id: user?.empresa_id,
                nombre: nombre || `Campaña ${new Date().toLocaleDateString()}`,
                objetivo: objetivo || 'seguimiento',
                mensaje_template: mensajeTemplate || '',
                estado: 'borrador'
            })
            .select()
            .single();

        if (campError) throw campError;

        // Ejecutar la campaña en segundo plano
        executeAICampaign(campaign.id, leadIds).catch(err => {
            console.error('[Campaign] Error en ejecución background:', err.message);
        });

        res.json({ 
            success: true, 
            campaignId: campaign.id,
            message: `Campaña iniciada para ${leadIds.length} leads. Procesando en segundo plano...` 
        });

    } catch (err) {
        console.error('[Campaign] Error creando campaña:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/whatsapp/admin/leads/:id/activity
// Obtiene historial de actividad de un lead
router.get('/admin/leads/:id/activity', async (req, res) => {
    const { id } = req.params;

    try {
        // Datos del lead
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (leadError) throw leadError;

        // Actividad registrada
        const { data: activity } = await supabase
            .from('leads_actividad')
            .select('*')
            .eq('lead_id', id)
            .order('created_at', { ascending: false })
            .limit(50);

        // Últimos mensajes del chat
        const { data: messages } = await supabase
            .from('mensajes_wa')
            .select('mensaje_texto, es_mio, created_at')
            .eq('remote_jid', `${lead.telefono}@s.whatsapp.net`)
            .order('created_at', { ascending: false })
            .limit(20);

        res.json({
            lead,
            activity: activity || [],
            recentMessages: (messages || []).reverse()
        });

    } catch (err) {
        console.error('[Lead-Detail] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// FASE 6: NOTIFICACIONES EN TIEMPO REAL
// =============================================

// GET /api/whatsapp/notifications?userId=xxx
router.get('/notifications', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const { data: user } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', userId).single();
        
        const { data: notifs, error } = await supabase
            .from('notificaciones')
            .select('*')
            .eq('empresa_id', user?.empresa_id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const unreadCount = (notifs || []).filter(n => !n.leida).length;
        res.json({ notifications: notifs || [], unreadCount });
    } catch (err) {
        console.error('[Notifications] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/notifications/read
router.post('/notifications/read', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const { data: user } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', userId).single();
        
        const { error } = await supabase
            .from('notificaciones')
            .update({ leida: true })
            .eq('empresa_id', user?.empresa_id)
            .eq('leida', false);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('[Notifications] Error marking read:', err);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// UPGRADE REQUEST FLOW
// =============================================

// POST /api/whatsapp/upgrade/request
// Agente solicita un upgrade para su empresa
router.post('/upgrade/request', async (req, res) => {
    const { userId, planSolicitado, notas } = req.body;
    if (!userId || !planSolicitado) {
        return res.status(400).json({ error: 'userId y planSolicitado son requeridos' });
    }
    try {
        // Obtener empresa del agente
        const { data: profile } = await supabase
            .from('perfiles_usuario')
            .select('empresa_id, email')
            .eq('id', userId)
            .single();

        if (!profile?.empresa_id) {
            return res.status(400).json({ error: 'El usuario no tiene empresa asociada' });
        }

        // Verificar que no haya ya una solicitud pendiente
        const { data: existing } = await supabase
            .from('solicitudes_upgrade')
            .select('id')
            .eq('empresa_id', profile.empresa_id)
            .eq('estado', 'pendiente')
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: 'Ya tienes una solicitud pendiente. Espera a que sea procesada.' });
        }

        const { data, error } = await supabase
            .from('solicitudes_upgrade')
            .insert({
                empresa_id: profile.empresa_id,
                user_id: userId,
                email_solicitante: profile.email,
                plan_solicitado: planSolicitado,
                notas: notas || null,
                estado: 'pendiente'
            })
            .select()
            .single();

        if (error) throw error;

        // --- ENVIAR NOTIFICACIONES POR EMAIL ---
        try {
            const planNombre = planSolicitado.toUpperCase();

            // 1. Email al Super-Admin
            await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: process.env.SMTP_USER,
                subject: `🚀 Nueva Solicitud de Upgrade - ${profile.email}`,
                text: `Hola Super-Admin,\n\nSe ha recibido una nueva solicitud de upgrade:\n- Empresa ID: ${profile.empresa_id}\n- Usuario: ${profile.email}\n- Plan Solicitado: ${planNombre}\n- Notas: ${notas || 'Ninguna'}\n\nPuedes gestionar esta solicitud en el panel de administración.`
            });

            // 2. Email al Usuario con instrucciones de pago
            await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: profile.email,
                subject: `📌 Instrucciones para tu Upgrade - Bot AI`,
                html: `
                    <div style="font-family: sans-serif; color: #111b21;">
                        <h2 style="color: #00a884;">¡Gracias por tu solicitud!</h2>
                        <p>Hemos recibido tu interés en activar el plan <strong>${planNombre}</strong>.</p>
                        <p>Para completar el proceso y activar tus beneficios, por favor realiza el pago con los siguientes datos:</p>
                        
                        <div style="background: #f0f2f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Datos de Pago (Transferencia Bancaria)</h3>
                            <p><strong>Banco:</strong> Banesco (Panamá o Venezuela según prefiera)</p>
                            <p><strong>Cuenta:</strong> 0134-XXXX-XXXX-XXXX-XXXX</p>
                            <p><strong>Beneficiario:</strong> Bot AI Solutions</p>
                            <p><strong>RIF / ID:</strong> J-XXXXXXXX-X</p>
                        </div>

                        <p><strong>⚠️ Importante:</strong> Una vez realizado el pago, por favor responde a este correo adjuntando el comprobante o envíalo a soporte@botai.com indicando tu ID de Empresa: <strong>${profile.empresa_id}</strong>.</p>
                        
                        <p>Nuestro equipo verificará la transacción y activará tu plan en un máximo de 24 horas.</p>
                    </div>
                `
            });
            console.log(`[Upgrade] Correos enviados para solicitud de ${profile.email}`);
        } catch (mailErr) {
            console.error('[Upgrade] Error enviando correos:', mailErr);
            // No fallamos la respuesta si solo falla el mail, pero lo logueamos
        }

        res.status(201).json(data);
    } catch (err) {
        console.error('[Upgrade] Error creating request:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/whatsapp/upgrade/requests
// Super-admin lista todas las solicitudes de upgrade
router.get('/upgrade/requests', async (req, res) => {
    const { callerUserId } = req.query;
    try {
        // Verificar que el caller es super-admin
        const { data: caller } = await supabase
            .from('perfiles_usuario')
            .select('role')
            .eq('id', callerUserId)
            .single();

        if (caller?.role !== 'super-admin') {
            return res.status(403).json({ error: 'Solo el super-admin puede ver las solicitudes' });
        }

        const { data, error } = await supabase
            .from('solicitudes_upgrade')
            .select(`
                *,
                empresas (nombre, plan)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[Upgrade] Error fetching requests:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/whatsapp/upgrade/requests/:id
// Super-admin aprueba o rechaza una solicitud
router.put('/upgrade/requests/:id', async (req, res) => {
    const { id } = req.params;
    const { callerUserId, accion, notaAdmin } = req.body; // accion: 'aprobar' | 'rechazar'

    if (!['aprobar', 'rechazar'].includes(accion)) {
        return res.status(400).json({ error: 'accion debe ser "aprobar" o "rechazar"' });
    }

    try {
        // Verificar super-admin
        const { data: caller } = await supabase
            .from('perfiles_usuario')
            .select('role')
            .eq('id', callerUserId)
            .single();

        if (caller?.role !== 'super-admin') {
            return res.status(403).json({ error: 'Solo el super-admin puede procesar solicitudes' });
        }

        // Obtener la solicitud
        const { data: solicitud } = await supabase
            .from('solicitudes_upgrade')
            .select('*')
            .eq('id', id)
            .single();

        if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
        if (solicitud.estado !== 'pendiente') {
            return res.status(409).json({ error: 'Esta solicitud ya fue procesada' });
        }

        const nuevoEstado = accion === 'aprobar' ? 'aprobada' : 'rechazada';

        // Si se aprueba, actualizar el plan de la empresa
        if (accion === 'aprobar') {
            const planLimits = {
                gratis:     { limite_agentes: 1,   limite_documentos: 0 },
                pro:        { limite_agentes: 5,   limite_documentos: 5 },
                enterprise: { limite_agentes: 999, limite_documentos: 999 }
            };
            const limits = planLimits[solicitud.plan_solicitado] || planLimits.gratis;

            // Calcular fecha de vencimiento (30 días desde hoy)
            const vencimiento = new Date();
            vencimiento.setDate(vencimiento.getDate() + 30);

            const { error: updateError } = await supabase
                .from('empresas')
                .update({
                    plan: solicitud.plan_solicitado,
                    limite_agentes: limits.limite_agentes,
                    limite_documentos: limits.limite_documentos,
                    vencimiento_plan: vencimiento.toISOString()
                })
                .eq('id', solicitud.empresa_id);

            if (updateError) throw updateError;
        }

        // Actualizar estado de la solicitud
        const { data, error } = await supabase
            .from('solicitudes_upgrade')
            .update({
                estado: nuevoEstado,
                nota_admin: notaAdmin || null,
                procesado_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // --- ENVIAR NOTIFICACIÓN DE RECHAZO SI CORRESPONDE ---
        if (accion === 'rechazar') {
            try {
                // El email_solicitante ya viene en el objeto 'solicitud' que cargamos antes
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || `"Bot AI" <${process.env.SMTP_USER}>`,
                    to: solicitud.email_solicitante,
                    subject: `Actualización de tu solicitud de Upgrade - Bot AI`,
                    html: `
                        <div style="font-family: sans-serif; color: #111b21;">
                            <h2 style="color: #ea4335;">Tu solicitud de Upgrade ha sido rechazada</h2>
                            <p>Hola, lamentamos informarte que tu solicitud para el plan <strong>${solicitud.plan_solicitado.toUpperCase()}</strong> no ha sido aprobada en este momento.</p>
                            
                            <div style="background: #fdf2f2; border-left: 4px solid #ea4335; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0; font-weight: bold;">Motivo del rechazo:</p>
                                <p style="margin: 10px 0 0 0;">${notaAdmin || 'No se proporcionó un motivo específico.'}</p>
                            </div>

                            <p>Si crees que esto es un error o deseas más información, por favor contacta a nuestro equipo de soporte en <a href="mailto:soporte@botai.com">soporte@botai.com</a>.</p>
                            <br>
                            <p>Saludos,<br>Equipo de Bot AI</p>
                        </div>
                    `
                });
                console.log(`[Upgrade] Email de rechazo enviado a ${solicitud.email_solicitante}`);
            } catch (mailErr) {
                console.error('[Upgrade] Error enviando email de rechazo:', mailErr);
            }
        }

        res.json(data);
    } catch (err) {
        console.error('[Upgrade] Error processing request:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/whatsapp/upgrade/my-request?userId=...
// Agente consulta el estado de su última solicitud
router.get('/upgrade/my-request', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    try {
        const { data: profile } = await supabase
            .from('perfiles_usuario')
            .select('empresa_id')
            .eq('id', userId)
            .single();

        if (!profile?.empresa_id) return res.json(null);

        const { data, error } = await supabase
            .from('solicitudes_upgrade')
            .select('*')
            .eq('empresa_id', profile.empresa_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// =============================================
// PERFIL Y VERIFICACIÓN OTP
// =============================================

const nodemailer = require('nodemailer');

// Transporter para nodemailer (Configurado en .env)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});


// POST /api/whatsapp/auth/register
// Registro de nuevo usuario + creación automática de empresa con prueba PRO de 7 días
router.post('/auth/register', async (req, res) => {
    const { email, password, nombreCompleto } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

    try {
        // 1. Verificar si el usuario ya existe en Auth
        const { data: { users } } = await supabase.auth.admin.listUsers();
        let authUser = users.find(u => u.email === email);
        let userId;

        if (!authUser) {
            // Crear si no existe
            const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: nombreCompleto }
            });
            if (authError) throw authError;
            userId = newUser.user.id;
        } else {
            userId = authUser.id;
        }

        // 2. Verificar o crear Empresa
        // (Buscamos si ya tiene un perfil con empresa_id)
        const { data: existingProfile } = await supabase
            .from('perfiles_usuario')
            .select('empresa_id')
            .eq('id', userId)
            .maybeSingle();

        let empresaId = existingProfile?.empresa_id;

        if (!empresaId) {
            const vencimientoTrial = new Date();
            vencimientoTrial.setDate(vencimientoTrial.getDate() + 7);

            const { data: empresa, error: empError } = await supabase
                .from('empresas')
                .insert({
                    nombre: `Empresa de ${nombreCompleto || email}`,
                    plan: 'pro',
                    limite_agentes: 5,
                    limite_documentos: 5,
                    vencimiento_plan: vencimientoTrial.toISOString(),
                    is_trial: true
                })
                .select()
                .single();

            if (empError) throw empError;
            empresaId = empresa.id;
        }

        // 3. Crear o Actualizar Perfil de Usuario
        const { error: profError } = await supabase
            .from('perfiles_usuario')
            .upsert({
                id: userId,
                email: email,
                nombre_display: nombreCompleto || '',
                role: 'agente',
                is_owner: true,
                empresa_id: empresaId,
                is_email_verified: false
            });

        if (profError) throw profError;

        res.status(201).json({ 
            success: true, 
            message: 'Usuario registrado. Por favor verifica tu email.',
            userId 
        });

    } catch (err) {
        console.error('[Register] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/auth/forgot-password
router.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    try {
        // 1. Generar link de recuperación mediante Supabase Admin
        // Esto NO envía un correo automáticamente, solo genera el link
        const { data, error } = await supabase.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: { 
                // Usamos el origin del request o una variable de entorno
                redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password` 
            }
        });

        if (error) {
            console.error('[Forgot-Password] Supabase Error:', error);
            return res.status(400).json({ error: error.message });
        }

        const recoveryLink = data.properties.action_link;

        // 2. Enviar email con el formato de la casa (Bot AI)
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || `"Bot AI" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Recupera tu contraseña - Bot AI',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #00a884; margin: 0;">Bot AI</h1>
                    </div>
                    <h2 style="color: #111b21; text-align: center;">Recuperar contraseña</h2>
                    <p>Hola,</p>
                    <p>Has solicitado restablecer tu contraseña en <strong>Bot AI</strong>. Haz clic en el siguiente botón para establecer una nueva clave:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${recoveryLink}" style="background-color: #00a884; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 16px;">
                            Restablecer contraseña
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #8696a0; text-align: center;">
                        Si no solicitaste este cambio, puedes ignorar este correo con seguridad.<br>
                        Este enlace es válido por tiempo limitado.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 10px; color: #b1b3b5; text-align: center;">
                        © ${new Date().getFullYear()} Bot AI Solutions. Todos los derechos reservados.
                    </p>
                </div>
            `
        });

        console.log(`[Forgot-Password] Email enviado a ${email}:`, info.messageId);
        res.json({ success: true, message: 'Email de recuperación enviado' });

    } catch (err) {
        console.error('[Forgot-Password] Internal Error:', err);
        res.status(500).json({ error: 'Error interno al procesar la solicitud' });
    }
});


// POST /api/whatsapp/otp/send
router.post('/otp/send', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId es requerido' });

    try {
        const { data: user, error: uError } = await supabase
            .from('perfiles_usuario')
            .select('email, is_email_verified')
            .eq('id', userId)
            .single();

        if (uError || !user) throw new Error('Usuario no encontrado');

        if (user.is_email_verified) {
            return res.json({ success: true, message: 'El usuario ya está verificado' });
        }

        // Generar OTP de 6 dígitos
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutos

        // Guardar en DB
        const { error: updError } = await supabase
            .from('perfiles_usuario')
            .update({
                otp_code: otp,
                otp_expires_at: expiresAt.toISOString()
            })
            .eq('id', userId);

        if (updError) throw updError;

        console.log(`[OTP] Enviando código a ${user.email} (UserId: ${userId})`);

        // Enviar email
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || `"Bot AI" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Tu código de verificación - Bot AI',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #00a884; text-align: center;">Verifica tu correo</h2>
                    <p>Hola,</p>
                    <p>Usa el siguiente código para completar tu registro en Bot AI:</p>
                    <div style="background: #f4f7f9; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111b21; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="font-size: 12px; color: #8696a0;">Este código expira en 10 minutos.</p>
                </div>
            `
        });

        console.log('[OTP] Email enviado con éxito:', info.messageId);
        res.json({ success: true, message: 'OTP enviado' });
    } catch (err) {
        console.error('[OTP] Error sending:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/otp/verify
router.post('/otp/verify', async (req, res) => {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ error: 'userId y code son requeridos' });

    try {
        const { data: user, error: uError } = await supabase
            .from('perfiles_usuario')
            .select('otp_code, otp_expires_at')
            .eq('id', userId)
            .single();

        if (uError || !user) throw new Error('Usuario no encontrado');

        if (user.otp_code !== code) {
            return res.status(400).json({ error: 'Código incorrecto' });
        }

        if (new Date(user.otp_expires_at) < new Date()) {
            return res.status(400).json({ error: 'El código ha expirado' });
        }

        // Verificar email
        const { error: updError } = await supabase
            .from('perfiles_usuario')
            .update({
                is_email_verified: true,
                otp_code: null,
                otp_expires_at: null
            })
            .eq('id', userId);

        if (updError) throw updError;

        res.json({ success: true });
    } catch (err) {
        console.error('[OTP] Error verifying:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/whatsapp/profile/update
router.post('/profile/update', async (req, res) => {
    const { userId, nombre, tipo_cuenta, telefono } = req.body;
    if (!userId || !nombre || !tipo_cuenta) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    try {
        // 1. Obtener perfil
        const { data: profile } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', userId).single();
        
        let empresaId = profile?.empresa_id;

        // 2. Upsert empresa
        // 2. Upsert empresa
        if (!empresaId) {
            // Crear nueva empresa si no existe
            const { data: newEmpresa, error: eError } = await supabase
                .from('empresas')
                .insert({
                    nombre: tipo_cuenta === 'empresa' ? nombre : '', 
                    telefono: tipo_cuenta === 'empresa' ? telefono : null,
                    plan: 'gratis',
                    limite_agentes: 1,
                    limite_documentos: 0
                })
                .select()
                .single();
            if (eError) throw eError;
            empresaId = newEmpresa.id;
        } else if (tipo_cuenta === 'empresa') {
            // Actualizar solo los datos de la EMPRESA si se seleccionó ese tipo
            await supabase.from('empresas').update({ 
                nombre, 
                telefono 
            }).eq('id', empresaId);
        }

        // 3. Actualizar perfil del usuario
        const updateData = {
            empresa_id: empresaId,
            tipo_cuenta: tipo_cuenta,
            // Si es personal, guardamos en perfiles_usuario. Si es empresa, también dejamos algo ahí como fallback
            nombre_display: nombre,
            telefono: tipo_cuenta === 'persona' ? telefono : (profile?.telefono || null)
        };

        // Si el usuario no tenía empresa antes, ahora es el DUEÑO (is_owner)
        if (!profile?.empresa_id) {
            updateData.is_owner = true;
        }

        const { error: pError } = await supabase
            .from('perfiles_usuario')
            .update(updateData)
            .eq('id', userId);

        if (pError) throw pError;

        res.json({ success: true, empresaId, is_owner: updateData.is_owner });
    } catch (err) {
        console.error('[Profile] Error updating:', err);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// AUTOMATIZACIÓN: RECORDATORIOS DE VENCIMIENTO
// =============================================

/**
 * Revisa empresas cuyo plan venza en exactamente 3 días y envía un recordatorio.
 */
async function checkExpiringPlans() {
    console.log('[Cron] Ejecutando revisión de planes por vencer...');
    try {
        const tresDiasParaVencer = new Date();
        tresDiasParaVencer.setDate(tresDiasParaVencer.getDate() + 3);

        const dosDiasParaVencer = new Date(); // Para el día 5 de 7 (trial)
        dosDiasParaVencer.setDate(dosDiasParaVencer.getDate() + 2);
        
        // --- 1. PROCESAR PLANES ESTÁNDAR (3 días antes) ---
        const start3 = new Date(tresDiasParaVencer.setHours(0,0,0,0)).toISOString();
        const end3 = new Date(tresDiasParaVencer.setHours(23,59,59,999)).toISOString();

        const { data: expiringStandard } = await supabase
            .from('empresas')
            .select('id, nombre, plan, vencimiento_plan')
            .eq('is_trial', false)
            .gte('vencimiento_plan', start3)
            .lte('vencimiento_plan', end3);

        if (expiringStandard) {
            for (const empresa of expiringStandard) {
                const { data: owner } = await supabase.from('perfiles_usuario').select('email').eq('empresa_id', empresa.id).eq('is_owner', true).maybeSingle();
                if (owner?.email) {
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM,
                        to: owner.email,
                        subject: `⚠️ Aviso: Tu plan en Bot AI vence en 3 días`,
                        html: `<h2>Tu plan ${empresa.plan.toUpperCase()} está por vencer</h2><p>Realiza tu pago para evitar interrupciones...</p>`
                    });
                }
            }
        }

        // --- 2. PROCESAR TRIALS (Día 5 de 7 = 2 días antes de vencer) ---
        const start2 = new Date(dosDiasParaVencer.setHours(0,0,0,0)).toISOString();
        const end2 = new Date(dosDiasParaVencer.setHours(23,59,59,999)).toISOString();

        const { data: expiringTrial } = await supabase
            .from('empresas')
            .select('id, nombre, plan, vencimiento_plan')
            .eq('is_trial', true)
            .gte('vencimiento_plan', start2)
            .lte('vencimiento_plan', end2);

        if (expiringTrial) {
            for (const empresa of expiringTrial) {
                const { data: owner } = await supabase.from('perfiles_usuario').select('email').eq('empresa_id', empresa.id).eq('is_owner', true).maybeSingle();
                if (owner?.email) {
                    await transporter.sendMail({
                        from: process.env.SMTP_FROM,
                        to: owner.email,
                        subject: `🚀 Tu prueba PRO de Bot AI está por vencer`,
                        html: `
                            <div style="font-family: sans-serif;">
                                <h2 style="color: #00a884;">¡Esperamos que estés disfrutando de PRO!</h2>
                                <p>Tu prueba gratuita de 7 días está en su <strong>día 5</strong> y vencerá en 48 horas.</p>
                                <p>Para mantener todas las funciones de gestión activas (agentes, leads, estadísticas), solicita tu upgrade desde el panel.</p>
                                <br>
                                <p>Saludos,<br>Equipo de Bot AI</p>
                            </div>
                        `
                    });
                    console.log(`[Cron] Aviso de Trial (día 5) enviado a ${owner.email}`);
                }
            }
        }
    } catch (err) {
        console.error('[Cron] Error en checkExpiringPlans:', err);
    }
}

/**
 * Inicia el monitor de expiración (corre cada 24 horas)
 */
function startPlanExpirationMonitor() {
    // Ejecutar inmediatamente al iniciar el server
    checkExpiringPlans();
    
    // Y luego cada 24 horas
    setInterval(checkExpiringPlans, 24 * 60 * 60 * 1000);
}

module.exports = {
    router,
    startPlanExpirationMonitor
};

