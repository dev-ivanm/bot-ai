const supabase = require('./supabase');

/**
 * Crea una notificación para una empresa.
 * @param {string} empresaId - ID de la empresa
 * @param {string} tipo - Tipo: 'lead_hot', 'lead_nuevo', 'campana_completada', 'cuota_limite'
 * @param {string} titulo - Título corto
 * @param {string} mensaje - Descripción
 * @param {object} metadata - Datos adicionales (leadId, campaignId, etc.)
 */
async function createNotification(empresaId, tipo, titulo, mensaje, metadata = {}) {
    try {
        if (!empresaId) {
            console.log('[Notifications] Skipping: No empresaId provided');
            return null;
        }

        const { data, error } = await supabase
            .from('notificaciones')
            .insert({
                empresa_id: empresaId,
                tipo,
                titulo,
                mensaje,
                metadata
            })
            .select()
            .single();

        if (error) {
            console.error('[Notifications] Error creando notificación:', error.message);
            return null;
        }

        console.log(`[Notifications] ✅ ${tipo}: ${titulo}`);
        return data;
    } catch (err) {
        console.error('[Notifications] Error:', err.message);
        return null;
    }
}

/**
 * Notifica cuando un lead alcanza alta probabilidad de compra.
 */
async function notifyHotLead(empresaId, leadName, probability) {
    return createNotification(
        empresaId,
        'lead_hot',
        `🔥 ¡Lead Caliente!`,
        `${leadName} tiene ${probability}% de probabilidad de compra. ¡Es momento de cerrar!`,
        { probability }
    );
}

/**
 * Notifica cuando se recibe un nuevo prospecto.
 */
async function notifyNewLead(empresaId, leadName, phone) {
    return createNotification(
        empresaId,
        'lead_nuevo',
        `👤 Nuevo Prospecto`,
        `${leadName || phone} inició una conversación. Ya fue registrado en tu CRM.`,
        { phone }
    );
}

/**
 * Notifica cuando una campaña finaliza.
 */
async function notifyCampaignComplete(empresaId, campaignName, sentCount) {
    return createNotification(
        empresaId,
        'campana_completada',
        `📣 Campaña Finalizada`,
        `"${campaignName}" se completó. ${sentCount} mensajes enviados exitosamente.`,
        { sentCount }
    );
}

/**
 * Notifica cuando se acerca al límite de cuota.
 */
async function notifyQuotaWarning(empresaId, resource, current, limit) {
    return createNotification(
        empresaId,
        'cuota_limite',
        `⚠️ Cuota al Límite`,
        `Has usado ${current}/${limit} ${resource}. Considera mejorar tu plan.`,
        { resource, current, limit }
    );
}

module.exports = { 
    createNotification, 
    notifyHotLead, 
    notifyNewLead, 
    notifyCampaignComplete, 
    notifyQuotaWarning 
};
