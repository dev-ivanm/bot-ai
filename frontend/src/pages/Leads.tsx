import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { 
  TrendingUp, 
  Search, 
  RefreshCcw, 
  User, 
  Phone, 
  Calendar,
  Zap,
  Smile,
  Frown,
  Meh,
  AlertCircle,
  Send,
  CheckSquare,
  Square,
  X,
  Eye
} from "lucide-react";
import { useAuth } from "../context/auth-context";
import { type PlanId, canAccess } from "../config/planConfig";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const API_URL = `${BACKEND_URL}/api/whatsapp`;

interface Lead {
  id: string;
  telefono: string;
  nombre: string;
  estado: string;
  probabilidad_compra: number;
  nivel_satisfaccion: number;
  sentimiento_actual: string;
  resumen_interes: string;
  ultimo_contacto: string;
}

const Leads = () => {
  const { session, role: authRole, plan: authPlan } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [analizandoId, setAnalizandoId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Campaign state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("seguimiento");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

      if (authRole !== "super-admin") {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("plan")
          .eq("id", userProfile.empresa_id)
          .single();
        
        if (!canAccess(empresa?.plan as PlanId, "leads")) {
          navigate("/dashboard");
          return;
        }
      }
    };
    checkAccess();
  }, [session, navigate, authRole]);

  const fetchLeads = useCallback(async () => {
    if (!session?.user.id) return;
    try {
      const res = await fetch(`${API_URL}/admin/leads?userId=${session.user.id}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  const analizarLeadsIA = async (id: string) => {
    setAnalizandoId(id);
    try {
      const res = await fetch(`${API_URL}/admin/leads/score/${id}`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchLeads();
      }
    } catch (err) {
      console.error("Error analizando lead:", err);
    } finally {
      setAnalizandoId(null);
    }
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const selectAllHotLeads = () => {
    const hotIds = leads.filter(l => l.probabilidad_compra >= 70).map(l => l.id);
    setSelectedLeads(hotIds);
  };

  const sendCampaign = async () => {
    if (!session?.user.id || selectedLeads.length === 0) return;
    setSendingCampaign(true);
    try {
      const res = await fetch(`${API_URL}/admin/campaign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          leadIds: selectedLeads,
          nombre: campaignName || `Campaña ${new Date().toLocaleDateString()}`,
          objetivo: campaignObjective,
          mensajeTemplate: campaignMessage
        })
      });
      if (res.ok) {
        setShowCampaignModal(false);
        setSelectionMode(false);
        setSelectedLeads([]);
        setCampaignName("");
        setCampaignMessage("");
      }
    } catch (err) {
      console.error("Error enviando campaña:", err);
    } finally {
      setSendingCampaign(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const getProbColor = (prob: number) => {
    if (prob >= 80) return "text-[#00a884] bg-[#00a884]/10 border-[#00a884]/20";
    if (prob >= 40) return "text-[#ffbc2d] bg-[#ffbc2d]/10 border-[#ffbc2d]/20";
    return "text-[#ea4335] bg-[#ea4335]/10 border-[#ea4335]/20";
  };

  const getSatisfactionIcon = (score: number) => {
    if (score >= 4) return <Smile size={16} className="text-[#00a884]" />;
    if (score >= 3) return <Meh size={16} className="text-[#ffbc2d]" />;
    return <Frown size={16} className="text-[#ea4335]" />;
  };

  const filteredLeads = leads.filter(l => 
    (l.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.telefono.includes(searchTerm)
  );

  return (
    <Layout>
      <div className="p-8 flex flex-col gap-8 flex-1 overflow-y-auto custom-scrollbar bg-[#0b141a]">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#00a884]/10 p-3 rounded-2xl shrink-0">
              <TrendingUp size={32} className="text-[#00a884]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#e9edef]">Leads y Ventas</h1>
              <p className="text-[#8696a0] text-xs sm:text-sm font-medium">Análisis de prospectos con Inteligencia Artificial</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {selectionMode ? (
              <>
                <button 
                  onClick={selectAllHotLeads}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#ffbc2d]/10 text-[#ffbc2d] px-4 py-2 rounded-xl hover:bg-[#ffbc2d]/20 transition-all text-xs font-semibold border border-[#ffbc2d]/20"
                >
                  <Zap size={14} /> Hot Leads
                </button>
                <button 
                  onClick={() => { setShowCampaignModal(true); }}
                  disabled={selectedLeads.length === 0}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#00a884] text-white px-4 py-2 rounded-xl hover:bg-[#008f6f] transition-all text-xs font-bold disabled:opacity-30"
                >
                  <Send size={14} /> Campaña ({selectedLeads.length})
                </button>
                <button 
                  onClick={() => { setSelectionMode(false); setSelectedLeads([]); }}
                  className="p-2 text-[#ea4335] hover:bg-[#ea4335]/10 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </>
            ) : (
              <>
                {(authRole === 'super-admin' || authPlan === 'enterprise') && (
                  <button 
                    onClick={() => setSelectionMode(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-[#00a884] to-[#00c896] text-white px-4 py-2 rounded-xl hover:brightness-110 transition-all text-xs font-bold shadow-lg"
                  >
                    <Send size={14} /> Iniciar Campaña
                  </button>
                )}
                <button 
                  onClick={() => fetchLeads()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#2a3942] text-[#e9edef] px-4 py-2 rounded-xl hover:bg-[#3b4a54] transition-all text-xs font-semibold"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                  Actualizar
                </button>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-[#202c33] p-4 sm:p-6 rounded-2xl border border-[#2a3942]">
            <p className="text-[#8696a0] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Total Prospectos</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#e9edef]">{leads.length}</p>
          </div>
          <div className="bg-[#202c33] p-4 sm:p-6 rounded-2xl border border-[#2a3942]">
            <p className="text-[#8696a0] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Hot Leads ({'>'} 80%)</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#00a884]">{leads.filter(l => l.probabilidad_compra >= 80).length}</p>
          </div>
          <div className="bg-[#202c33] p-4 sm:p-6 rounded-2xl border border-[#2a3942] sm:col-span-2 lg:col-span-1">
            <p className="text-[#8696a0] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Interés Promedio</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#ffbc2d]">
              {leads.length > 0 ? Math.round(leads.reduce((a, b) => a + b.probabilidad_compra, 0) / leads.length) : 0}%
            </p>
          </div>
        </div>

        <div className="bg-[#202c33] rounded-2xl border border-[#2a3942] overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-6 border-b border-[#2a3942] bg-[#1c272d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-[#e9edef] font-bold flex items-center gap-2 whitespace-nowrap">
              <Zap size={18} className="text-[#ffbc2d]" /> Embudos de Conversión
            </h3>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-[#54656f]" />
              <input 
                type="text" 
                placeholder="Buscar lead..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111b21] text-xs p-2.5 pl-10 rounded-lg border border-[#2a3942] text-[#e9edef] outline-none focus:border-[#00a884]/50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#111b21]">
                  {selectionMode && <th className="p-4 border-b border-[#2a3942] w-12"></th>}
                  <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Contacto</th>
                  <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Probabilidad</th>
                  <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Satisfacción</th>
                  <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Resumen IA</th>
                  <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={selectionMode ? 6 : 5} className="p-12 text-center text-[#8696a0] italic">Analizando mercado...</td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={selectionMode ? 6 : 5} className="p-12 text-center text-[#8696a0] italic">
                      <AlertCircle size={48} className="text-[#2a3942] mx-auto mb-4" />
                      No hay leads registrados aún. Recibe mensajes para verlos aquí.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#1c272d] transition-colors border-b border-[#2a3942]/50">
                      {selectionMode && (
                        <td className="p-4">
                          <button onClick={() => toggleLeadSelection(lead.id)} className="text-[#8696a0] hover:text-[#00a884] transition-colors">
                            {selectedLeads.includes(lead.id) 
                              ? <CheckSquare size={20} className="text-[#00a884]" /> 
                              : <Square size={20} />
                            }
                          </button>
                        </td>
                      )}
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-[#e9edef] font-bold text-sm flex items-center gap-2">
                            <User size={14} className="text-[#8696a0]" /> {lead.nombre || lead.telefono}
                          </span>
                          <span className="text-[#8696a0] text-xs flex items-center gap-2">
                            <Phone size={12} /> {lead.telefono}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${getProbColor(lead.probabilidad_compra)}`}>
                          <Zap size={12} fill="currentColor" />
                          {lead.probabilidad_compra}% {lead.estado}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getSatisfactionIcon(lead.nivel_satisfaccion)}
                          <span className="text-[#8696a0] text-xs font-medium">{lead.sentimiento_actual}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="max-w-xs">
                          <p className="text-[#e9edef] text-xs line-clamp-2 italic">
                            "{lead.resumen_interes || 'Sin análisis reciente'}"
                          </p>
                          <span className="text-[#8696a0] text-[10px] flex items-center gap-1 mt-1">
                            <Calendar size={10} /> {new Date(lead.ultimo_contacto).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button 
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            className="bg-[#2a3942] text-[#8696a0] p-2 rounded-lg hover:bg-[#3b4a54] hover:text-[#e9edef] transition-all"
                            title="Ver detalle"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => void analizarLeadsIA(lead.id)}
                            disabled={analizandoId === lead.id}
                            className="bg-[#00a884] text-white p-2 rounded-lg hover:bg-[#008f6f] transition-all disabled:opacity-50"
                            title="Analizar con IA"
                          >
                            <RefreshCcw size={16} className={analizandoId === lead.id ? "animate-spin" : ""} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-2xl border border-[#2a3942] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-[#2a3942] bg-[#1c272d] flex items-center justify-between">
              <h3 className="text-[#e9edef] font-bold flex items-center gap-2">
                <Send size={18} className="text-[#00a884]" /> Campaña Personalizada con IA
              </h3>
              <button onClick={() => setShowCampaignModal(false)} className="text-[#8696a0] hover:text-[#ea4335]">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <div className="bg-[#111b21] p-4 rounded-xl border border-[#2a3942]/50">
                <p className="text-[#8696a0] text-[10px] uppercase font-bold tracking-widest mb-1">Leads seleccionados</p>
                <p className="text-[#00a884] text-2xl font-black">{selectedLeads.length} prospectos</p>
              </div>

              <div>
                <label className="text-[#8696a0] text-xs font-bold uppercase block mb-2">Nombre de Campaña</label>
                <input 
                  type="text" 
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ej: Seguimiento Marzo 2026"
                  className="w-full bg-[#111b21] p-3 rounded-xl border border-[#2a3942] text-[#e9edef] text-sm outline-none focus:border-[#00a884] transition-colors"
                />
              </div>

              <div>
                <label className="text-[#8696a0] text-xs font-bold uppercase block mb-2">Objetivo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "seguimiento", label: "Seguimiento", emoji: "📞" },
                    { key: "oferta", label: "Oferta", emoji: "🏷️" },
                    { key: "fidelizacion", label: "Fidelización", emoji: "💎" }
                  ].map(obj => (
                    <button
                      key={obj.key}
                      onClick={() => setCampaignObjective(obj.key)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        campaignObjective === obj.key 
                          ? "bg-[#00a884]/10 border-[#00a884] text-[#00a884]" 
                          : "bg-[#111b21] border-[#2a3942] text-[#8696a0] hover:border-[#3b4a54]"
                      }`}
                    >
                      {obj.emoji} {obj.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[#8696a0] text-xs font-bold uppercase block mb-2">Instrucciones (Opcional)</label>
                <textarea 
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  placeholder="Ej: Ofrecer un 15% de descuento en su producto de interés..."
                  rows={3}
                  className="w-full bg-[#111b21] p-3 rounded-xl border border-[#2a3942] text-[#e9edef] text-sm outline-none resize-none focus:border-[#00a884] transition-colors"
                />
              </div>

              <button 
                onClick={sendCampaign}
                disabled={sendingCampaign}
                className="w-full bg-gradient-to-r from-[#00a884] to-[#00c896] text-white py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingCampaign ? (
                  <><RefreshCcw size={16} className="animate-spin" /> Enviando...</>
                ) : (
                  <><Send size={16} /> Lanzar Campaña con IA</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Leads;
