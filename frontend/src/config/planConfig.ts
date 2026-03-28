// =============================================
// CONFIGURACIÓN CENTRALIZADA DE PLANES
// =============================================

export type PlanId = 'gratis' | 'pro' | 'enterprise';

export type Feature = 
  | 'chats'
  | 'cerebro'
  | 'prompt'
  | 'leads'
  | 'lead_scoring'
  | 'campanas'
  | 'stats'
  | 'stats_advanced'
  | 'notificaciones'
  | 'usuarios';

export interface PlanConfig {
  id: PlanId;
  nombre: string;
  precio: string;
  precioNum: number;
  color: string;
  colorGradient: string;
  emoji: string;
  features: Feature[];
  limits: {
    agentes: number;
    instancias: number;
    memoria: number;
  };
  highlights: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  gratis: {
    id: 'gratis',
    nombre: 'Gratis',
    precio: '$0',
    precioNum: 0,
    color: '#8696a0',
    colorGradient: 'from-[#8696a0] to-[#54656f]',
    emoji: '🆓',
    features: ['chats'],
    limits: { agentes: 1, instancias: 1, memoria: 0 },
    highlights: [
      '1 instancia de WhatsApp',
      '1 agente',
      'Chat en tiempo real',
    ]
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precio: '$29/mes',
    precioNum: 29,
    color: '#ffbc2d',
    colorGradient: 'from-[#ffbc2d] to-[#ff9500]',
    emoji: '⭐',
    features: ['chats', 'cerebro', 'prompt', 'leads', 'stats', 'usuarios'],
    limits: { agentes: 5, instancias: 3, memoria: 10 },
    highlights: [
      '5 instancias de WhatsApp',
      'Hasta 5 agentes',
      'Cerebro IA (10 entradas)',
      'Prompt personalizado',
      'CRM / Vista de Leads',
      'Estadísticas básicas',
    ]
  },
  enterprise: {
    id: 'enterprise',
    nombre: 'Enterprise',
    precio: '$79/mes',
    precioNum: 79,
    color: '#a461d8',
    colorGradient: 'from-[#a461d8] to-[#7c3aed]',
    emoji: '💎',
    features: [
      'chats', 'cerebro', 'prompt', 'leads', 
      'lead_scoring', 'campanas', 'stats', 'stats_advanced', 
      'notificaciones', 'usuarios'
    ],
    limits: { agentes: 999, instancias: 999, memoria: 999 },
    highlights: [
      'Instancias ilimitadas',
      'Agentes ilimitados',
      'Cerebro IA ilimitado',
      'AI Lead Scoring',
      'Campañas de IA masivas',
      'Embudo de Ventas + Ranking',
      'Notificaciones en tiempo real',
    ]
  }
};

/**
 * Verifica si un plan tiene acceso a una feature.
 */
export function canAccess(plan: PlanId | string | null | undefined, feature: Feature): boolean {
  const planId = (plan || 'gratis') as PlanId;
  const config = PLANS[planId];
  if (!config) return false;
  return config.features.includes(feature);
}

/**
 * Retorna la feature requerida para una ruta del sidebar.
 */
export function getFeatureForRoute(path: string): Feature | null {
  const routeMap: Record<string, Feature> = {
    '/dashboard': 'chats',
    '/users': 'usuarios',
    '/leads': 'leads',
    '/stats': 'stats',
    '/upgrade': 'chats', // siempre accesible
  };
  return routeMap[path] || null;
}
