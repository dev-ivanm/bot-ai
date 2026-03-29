import { useState, useEffect } from "react";
import { BarChart3, Users, TrendingUp, Activity } from "lucide-react";
import { supabase } from "../lib/supabase";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { type PlanId, canAccess } from "../config/planConfig";

const Stats = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalAgents: 0,
    totalMessages: 0,
    activeChats: 0,
    totalLeads: 0,
    avgProbability: 0,
    avgSatisfaction: 0,
    conversionRate: 0,
    agentRanking: [] as { email: string; hotLeads: number }[],
    quotas: { agentes: 0, limitAgents: 0 },
    funnel: { total: 0, prospecto: 0, interesado: 0, cliente: 0, descartado: 0 },
    activityMetrics: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[]
  });
  const [loading, setLoading] = useState(true);
  // const [userRole, setUserRole] = useState<string | null>(null);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAccess = async () => {
      if (!session?.user.id) return;
      const { data: userProfile } = await supabase
        .from("perfiles_usuario")
        .select("role, empresa_id")
        .eq("id", session.user.id)
        .single();
      
      if (!userProfile) {
        navigate("/dashboard");
        return;
      }

      // setUserRole(userProfile.role); 

      // El super-admin tiene acceso absoluto, el agente debe validar el plan de la empresa
      if (userProfile.role !== "super-admin") {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("plan")
          .eq("id", userProfile.empresa_id)
          .single();
        
        if (!canAccess(empresa?.plan as PlanId, "stats")) {
          navigate("/dashboard");
          return;
        }
      }
    };
    checkAccess();
  }, [session, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      
      // 1. Contar usuarios por rol
      const { data: profiles } = await supabase
        .from("perfiles_usuario")
        .select("id, email, role");
      
      const counts = (profiles || []).reduce((acc: { total: number; admins: number; agents: number }, curr: { id: string; email: string; role: string }) => {
        acc.total++;
        if (curr.role === 'super-admin') acc.admins++;
        else acc.agents++;
        return acc;
      }, { total: 0, admins: 0, agents: 0 });

      // 2. Contar mensajes totales
      const { count: msgCount } = await supabase
        .from("mensajes_wa")
        .select("*", { count: 'exact', head: true });

      // Obtener límites de la empresa del admin actual
      const { data: profile } = await supabase.from('perfiles_usuario').select('empresa_id').eq('id', session?.user.id).single();
      const { data: empresa } = await supabase.from('empresas').select('*').eq('id', profile?.empresa_id).single();

      // 3. Obtener KPIs de Leads
      const { data: leads } = await supabase
        .from("leads")
        .select("probabilidad_compra, nivel_satisfaccion, estado, agente_id");
      
      const leadStats = (leads || []).reduce((acc, curr) => {
        acc.total++;
        acc.sumProb += (curr.probabilidad_compra || 0);
        acc.sumSat += (curr.nivel_satisfaccion || 0);
        if (curr.estado === 'cliente' || curr.estado === 'interesado') acc.conversions++;
        // Funnel counts
        const estado = (curr.estado || 'prospecto').toLowerCase();
        if (estado === 'prospecto') acc.funnelP++;
        else if (estado === 'interesado') acc.funnelI++;
        else if (estado === 'cliente') acc.funnelC++;
        else if (estado === 'descartado') acc.funnelD++;
        return acc;
      }, { total: 0, sumProb: 0, sumSat: 0, conversions: 0, funnelP: 0, funnelI: 0, funnelC: 0, funnelD: 0 });

      // Simulación de chats activos (esto vendría de Evolution API o una tabla de chats)
      const activeChatsInit = Math.floor(Math.random() * 10) + 5;

      // 4. Obtener actividad real (mensajes por mes del año actual)
      const currentYear = new Date().getFullYear();
      const { data: messages } = await supabase
        .from("mensajes_wa")
        .select("created_at")
        .gte("created_at", `${currentYear}-01-01`);

      const monthlyData = new Array(12).fill(0);
      (messages || []).forEach(m => {
        const month = new Date(m.created_at).getMonth();
        monthlyData[month]++;
      });

      const maxMessages = Math.max(...monthlyData, 1);
      const scaledData = monthlyData.map(count => Math.round((count / maxMessages) * 100));

      setStats({
        totalUsers: counts.total,
        totalAdmins: counts.admins,
        totalAgents: counts.agents,
        totalMessages: msgCount || 0,
        activeChats: activeChatsInit,
        totalLeads: leadStats.total,
        avgProbability: leadStats.total > 0 ? Math.round(leadStats.sumProb / leadStats.total) : 0,
        avgSatisfaction: leadStats.total > 0 ? Number((leadStats.sumSat / leadStats.total).toFixed(1)) : 0,
        conversionRate: leadStats.total > 0 ? Math.round((leadStats.conversions / leadStats.total) * 100) : 0,
        agentRanking: (profiles || []).map(p => {
          const hotLeads = (leads || []).filter(l => l.agente_id === p.id && (l.probabilidad_compra || 0) > 70).length;
          return { email: p.email, hotLeads };
        }).sort((a, b) => b.hotLeads - a.hotLeads).slice(0, 5),
        quotas: {
          agentes: counts.agents,
          limitAgents: empresa?.limite_agentes || 2,
        },
        funnel: {
          total: leadStats.total,
          prospecto: leadStats.funnelP,
          interesado: leadStats.funnelI,
          cliente: leadStats.funnelC,
          descartado: leadStats.funnelD
        },
        activityMetrics: scaledData
      });
      
      setLoading(false);
    };

    fetchStats();
  }, [session?.user.id]);

  const cards = [
    { label: "Leads Totales", value: stats.totalLeads, icon: <Users className="text-[#34b7f1]" />, color: "bg-[#34b7f1]/10" },
    { label: "Probabilidad Promedio", value: `${stats.avgProbability}%`, icon: <TrendingUp className="text-[#00a884]" />, color: "bg-[#00a884]/10" },
    { label: "Satisfacción Cliente", value: `${stats.avgSatisfaction}/5`, icon: <Activity className="text-[#ffbc2d]" />, color: "bg-[#ffbc2d]/10" },
    { label: "Tasa de Conversión", value: `${stats.conversionRate}%`, icon: <TrendingUp className="text-[#a461d8]" />, color: "bg-[#a461d8]/10" },
  ];

  return (
    <Layout>
      <div className="p-8 flex flex-col gap-8 flex-1 overflow-y-auto custom-scrollbar bg-[#0b141a]">
        <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="bg-[#a461d8]/10 p-3 rounded-2xl shrink-0">
            <BarChart3 size={32} className="text-[#a461d8]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#e9edef]">Estadísticas Globales</h1>
            <p className="text-[#8696a0] text-xs sm:text-sm font-medium">Métricas de rendimiento y actividad del sistema</p>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#8696a0] animate-pulse italic">Analizando datos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {cards.map((card, i) => (
              <div key={i} className="bg-[#202c33] p-6 rounded-2xl border border-[#2a3942] shadow-xl flex flex-col gap-4 hover:border-[#38444d] transition-all group">
                <div className="flex justify-between items-start">
                  <div className={`${card.color} p-3 rounded-xl transition-transform group-hover:scale-110`}>
                    {card.icon}
                  </div>
                  <span className="text-[10px] bg-[#111b21] text-[#8696a0] px-2 py-1 rounded-full font-bold">HOY</span>
                </div>
                <div>
                  <p className="text-[#8696a0] text-xs font-bold uppercase tracking-widest">{card.label}</p>
                  <p className="text-3xl font-black text-[#e9edef] mt-1">{card.value}</p>
                </div>
              </div>
            ))}

            {/* Sales Funnel */}
            <div className="sm:col-span-2 lg:col-span-4 bg-[#202c33] p-5 sm:p-8 rounded-2xl border border-[#2a3942] shadow-2xl">
              <h3 className="text-[#e9edef] font-bold flex items-center gap-2 mb-6">
                <TrendingUp size={18} className="text-[#a461d8]" /> Embudo de Ventas
              </h3>
              <div className="flex flex-col items-center gap-1">
                {[
                  { label: "Total Contactos", count: stats.funnel.total, color: "#34b7f1", width: "100%" },
                  { label: "Prospectos", count: stats.funnel.prospecto, color: "#8696a0", width: "80%" },
                  { label: "Interesados", count: stats.funnel.interesado, color: "#ffbc2d", width: "55%" },
                  { label: "Clientes", count: stats.funnel.cliente, color: "#00a884", width: "30%" },
                ].map((stage, i) => (
                  <div key={i} className="w-full flex items-center gap-2 sm:gap-4">
                    <div className="w-20 sm:w-28 text-right shrink-0">
                      <p className="text-[#8696a0] text-[9px] sm:text-[10px] uppercase font-bold tracking-widest leading-tight">{stage.label}</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div 
                        className="h-8 sm:h-10 rounded-lg flex items-center justify-center transition-all duration-500 hover:brightness-125 cursor-default"
                        style={{ 
                          width: stage.width, 
                          backgroundColor: `${stage.color}20`,
                          borderLeft: `2px sm:border-left-3 solid ${stage.color}`,
                          borderRight: `2px sm:border-right-3 solid ${stage.color}`
                        }}
                      >
                        <span className="text-[#e9edef] font-black text-xs sm:text-sm">{stage.count}</span>
                      </div>
                    </div>
                    <div className="w-12 sm:w-16 shrink-0">
                      <p className="text-[#54656f] text-[9px] sm:text-[10px] font-bold">
                        {stats.funnel.total > 0 ? Math.round((stage.count / stats.funnel.total) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
                {stats.funnel.descartado > 0 && (
                  <div className="mt-2 text-[10px] text-[#ea4335] font-bold">
                    {stats.funnel.descartado} leads descartados
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 bg-[#202c33] p-5 sm:p-8 rounded-2xl border border-[#2a3942] shadow-2xl flex flex-col gap-6">
               <div className="flex justify-between items-center">
                 <h3 className="text-[#e9edef] font-bold flex items-center gap-2">
                   <Activity size={18} className="text-[#00a884]" /> Actividad del Sistema
                 </h3>
                 <div className="flex gap-2">
                    <button className="text-[10px] bg-[#111b21] text-[#8696a0] px-3 py-1 rounded-lg border border-[#2a3942]">Semana</button>
                    <button className="text-[10px] bg-[#00a884] text-[#111b21] px-3 py-1 rounded-lg font-bold">Mes</button>
                 </div>
               </div>
               
               <div className="h-64 flex items-end gap-2 px-2 pb-2">
                   {stats.activityMetrics.map((h, i) => (
                     <div key={i} className="flex-1 bg-gradient-to-t from-[#00a884]/20 to-[#00a884] rounded-t-sm transition-all hover:brightness-125 cursor-pointer relative group" 
                          style={{ height: `${Math.max(h, 5)}%` }}>
                       <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#111b21] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-[#2a3942] pointer-events-none">
                         {h}%
                       </span>
                     </div>
                   ))}
                </div>
               <div className="flex justify-between text-[10px] text-[#8696a0] font-bold px-2">
                 <span>ENE</span>
                 <span>MAR</span>
                 <span>MAY</span>
                 <span>JUL</span>
                 <span>SEP</span>
                 <span>DIC</span>
               </div>
            </div>

            <div className="lg:col-span-1 bg-gradient-to-br from-[#1c272d] to-[#111b21] p-8 rounded-2xl border border-[#2a3942] shadow-2xl flex flex-col gap-6">
              <div>
                <TrendingUp size={28} className="text-[#00a884] mb-4" />
                <h3 className="text-[#e9edef] font-bold text-xl leading-tight">Ranking de Agentes</h3>
                <p className="text-[#8696a0] text-[10px] uppercase font-bold tracking-widest mt-1">Por Leads con Alta Probabilidad</p>
              </div>
              
              <div className="flex flex-col gap-4 mt-2">
                {stats.agentRanking.length === 0 ? (
                  <p className="text-[#8696a0] text-xs italic">No hay datos de ranking aún</p>
                ) : (
                  stats.agentRanking.map((agent, i) => (
                    <div key={i} className="flex justify-between items-center bg-[#202c33]/50 p-3 rounded-xl border border-[#2a3942]/30">
                      <div className="flex flex-col">
                        <span className="text-[#e9edef] text-xs font-bold truncate max-w-[120px]">{agent.email.split('@')[0]}</span>
                        <span className="text-[9px] text-[#8696a0]">Agente Activo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00a884] font-black">{agent.hotLeads}</span>
                        <div className="w-8 h-1 bg-[#111b21] rounded-full overflow-hidden">
                           <div className="bg-[#00a884] h-full" style={{ width: `${(agent.hotLeads / (stats.totalLeads || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-auto pt-6 border-t border-[#2a3942]/50">
                 <h4 className="text-[#8696a0] text-[10px] font-bold uppercase mb-3">Mapa de Calor (Ventas)</h4>
                 <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: 18 }).map((_, i) => {
                      const opacities = [0.1, 0.3, 0.6, 0.2, 0.8, 0.4, 0.9, 0.2, 0.5, 0.7, 0.3, 0.1, 0.6, 0.8, 0.4, 0.2, 0.1, 0.5];
                      return (
                        <div key={i} className="aspect-square rounded-sm transition-all hover:scale-110 cursor-help" 
                             title={`Actividad: ${opacities[i] * 100}%`}
                             style={{ backgroundColor: `rgba(0, 168, 132, ${opacities[i]})` }}>
                        </div>
                      );
                    })}
                 </div>
              </div>
            </div>
           
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Stats;
