const { getDeepSeekResponse } = require('./deepseek');
const supabase = require('./supabase');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { notifyCampaignComplete } = require('./notifications');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

/**
 * Ejecuta una campaña de marketing automatizada con IA.
 * @param {string} campaignId - ID de la campaña en public.campanas
 * @param {Array<string>} leadIds - Lista de IDs de leads objetivos
 */
async function executeAICampaign(campaignId, leadIds) {
    try {
        console.log(`[Campaign-Service] Iniciando campaña: ${campaignId} para ${leadIds.length} leads`);

        // 1. Obtener datos de la campaña
        const { data: campaign, error: campError } = await supabase
            .from('campanas')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (campError || !campaign) throw new Error("Campaña no encontrada");

        // Actualizar estado de la campaña
        await supabase.from('campanas').update({ estado: 'enviando' }).eq('id', campaignId);

        // 2. Procesar cada lead
        let correctos = 0;
        for (const leadId of leadIds) {
            try {
                // Obtener datos del lead
                const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
                if (!lead) continue;

                // Obtener instancia del agente asignado para enviar el mensaje
                const { data: profileBot } = await supabase.from('perfiles_bot').select('instance_name').eq('id', lead.agente_id).single();
                const instanceName = profileBot?.instance_name || 'main'; // Fallback a instancia principal

                // 3. Generar mensaje personalizado con IA
                const generationPrompt = `Genera un mensaje corto (máx 30 palabras) y persuasivo para una campaña de WhatsApp.
                
                [OBJETIVO DE LA CAMPAÑA]: ${campaign.objetivo}. ${campaign.mensaje_template || ''}
                [DATOS DEL CLIENTE]:
                - Nombre: ${lead.nombre || 'Cliente'}
                - Interés previo: ${lead.resumen_interes || 'Información general'}
                
                [REGLA]: Sé amable, usa su nombre si está disponible y termina con una pregunta abierta. No uses emojis excesivos.`;

                const personalizedMessage = await getDeepSeekResponse(generationPrompt, []);

                // 4. Enviar vía Evolution API
                const sendResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_API_KEY
                    },
                    body: JSON.stringify({
                        number: lead.telefono,
                        options: { delay: 1200, presence: "composing" },
                        textMessage: { text: personalizedMessage }
                    })
                });

                if (sendResponse.ok) {
                    correctos++;
                    // Registrar en campana_leads
                    await supabase.from('campana_leads').insert({
                        campana_id: campaignId,
                        lead_id: leadId,
                        mensaje_generated: personalizedMessage,
                        sent_at: new Date().toISOString()
                    });

                    // Registrar en actividad del lead
                    await supabase.from('leads_actividad').insert({
                        lead_id: leadId,
                        tipo: 'campaña_recibida',
                        detalle: `Recibió campaña "${campaign.nombre}"`
                    });
                } else {
                    console.error(`[Campaign-Service] Error enviando a ${lead.telefono}:`, await sendResponse.text());
                }

                // Espera prudencial para evitar bloqueos
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (err) {
                console.error(`[Campaign-Service] Error procesando lead ${leadId}:`, err.message);
            }
        }

        // 5. Finalizar campaña
        await supabase.from('campanas').update({ 
            estado: 'completada', 
            leads_alcanzados: correctos 
        }).eq('id', campaignId);

        // Notificar finalización
        await notifyCampaignComplete(campaign.empresa_id, campaign.nombre, correctos);

        console.log(`[Campaign-Service] Campaña finalizada. ${correctos} mensajes enviados.`);
        return { success: true, sent: correctos };

    } catch (err) {
        console.error("[Campaign-Service] Error crítico:", err.message);
        await supabase.from('campanas').update({ estado: 'error' }).eq('id', campaignId);
        throw err;
    }
}

module.exports = { executeAICampaign };
