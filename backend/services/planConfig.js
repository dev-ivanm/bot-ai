// =============================================
// CONFIGURACIÓN DE PLANES (Backend)
// =============================================

const PLAN_FEATURES = {
    gratis: ['chats'],
    pro: ['chats', 'cerebro', 'prompt', 'leads', 'stats', 'usuarios'],
    enterprise: [
        'chats', 'cerebro', 'prompt', 'leads',
        'lead_scoring', 'campanas', 'stats', 'stats_advanced',
        'notificaciones', 'usuarios'
    ]
};

/**
 * Verifica si un plan tiene acceso a una feature.
 */
function canAccess(plan, feature) {
    const planId = plan || 'gratis';
    const features = PLAN_FEATURES[planId];
    if (!features) return false;
    return features.includes(feature);
}

module.exports = { PLAN_FEATURES, canAccess };
