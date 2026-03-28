import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../context/auth-context";
import { supabase } from "../lib/supabase";
import { 
  ArrowLeft, User, Phone, Zap, Smile, Frown, Meh, 
  MessageCircle, RefreshCcw, Activity, Clock, Send
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const API_URL = `${BACKEND_URL}/api/whatsapp`;

interface LeadData {
  id: string;
  telefono: string;
  nombre: string;
  estado: string;
  probabilidad_compra: number;
  nivel_satisfaccion: number;
  sentimiento_actual: string;
  resumen_interes: string;
  ultimo_contacto: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  tipo: string;
  detalle: string;
  created_at: string;
}

interface ChatMessage {
  mensaje_texto: string;
  es_mio: boolean;
  created_at: string;
}

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!session?.user.id) return;
      const { data } = await supabase
        .from("perfiles_usuario")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (data?.role !== "super-admin") navigate("/dashboard");
    };
    checkAccess();
  }, [session, navigate]);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/leads/${id}/activity`);
      if (res.ok) {
        const data = await res.json();
        setLead(data.lead);
        setActivity(data.activity);
        setMessages(data.recentMessages);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const rescore = async () => {
    if (!id) return;
    setScoring(true);
    try {
      await fetch(`${API_URL}/admin/leads/score/${id}`, { method: "POST" });
      await fetchDetail();
    } catch (err) {
      console.error("Error re-scoring:", err);
    } finally {
      setScoring(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDetail(); }, [id]);

  const getProbColor = (prob: number) => {
    if (prob >= 80) return "text-[#00a884]";
    if (prob >= 40) return "text-[#ffbc2d]";
    return "text-[#ea4335]";
  };

  const getSatIcon = (s: number) => {
    if (s >= 4) return <Smile size={20} className="text-[#00a884]" />;
    if (s >= 3) return <Meh size={20} className="text-[#ffbc2d]" />;
    return <Frown size={20} className="text-[#ea4335]" />;
  };

  const getActivityIcon = (tipo: string) => {
    if (tipo === "campaña_recibida") return <Send size={14} className="text-[#00a884]" />;
    if (tipo === "scoring_actualizado") return <Zap size={14} className="text-[#ffbc2d]" />;
    return <Activity size={14} className="text-[#8696a0]" />;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center bg-[#0b141a]">
          <RefreshCcw size={32} className="text-[#00a884] animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!lead) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center bg-[#0b141a] text-[#8696a0]">
          Lead no encontrado.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar bg-[#0b141a]">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/leads")} className="p-2 bg-[#2a3942] rounded-xl hover:bg-[#3b4a54] transition-all">
            <ArrowLeft size={20} className="text-[#e9edef]" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#e9edef] flex items-center gap-2">
              <User size={20} className="text-[#8696a0]" />
              {lead.nombre || lead.telefono}
            </h1>
            <p className="text-[#8696a0] text-xs flex items-center gap-2">
              <Phone size={12} /> {lead.telefono}
            </p>
          </div>
          <button 
            onClick={rescore} 
            disabled={scoring}
            className="flex items-center gap-2 bg-[#00a884] text-white px-4 py-2 rounded-xl hover:bg-[#008f6f] transition-all text-sm font-bold disabled:opacity-50"
          >
            <RefreshCcw size={16} className={scoring ? "animate-spin" : ""} /> Re-analizar
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#202c33] p-5 rounded-2xl border border-[#2a3942] text-center">
            <p className="text-[#8696a0] text-[10px] uppercase font-bold tracking-widest">Probabilidad</p>
            <p className={`text-4xl font-black mt-1 ${getProbColor(lead.probabilidad_compra)}`}>{lead.probabilidad_compra}%</p>
          </div>
          <div className="bg-[#202c33] p-5 rounded-2xl border border-[#2a3942] text-center">
            <p className="text-[#8696a0] text-[10px] uppercase font-bold tracking-widest">Satisfacción</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              {getSatIcon(lead.nivel_satisfaccion)}
              <span className="text-2xl font-black text-[#e9edef]">{lead.nivel_satisfaccion}/5</span>
            </div>
          </div>
          <div className="bg-[#202c33] p-5 rounded-2xl border border-[#2a3942] text-center">
            <p className="text-[#8696a0] text-[10px] uppercase font-bold tracking-widest">Estado</p>
            <p className="text-lg font-bold text-[#e9edef] mt-2 capitalize">{lead.estado}</p>
          </div>
          <div className="bg-[#202c33] p-5 rounded-2xl border border-[#2a3942] text-center">
            <p className="text-[#8696a0] text-[10px] uppercase font-bold tracking-widest">Sentimiento</p>
            <p className="text-lg font-bold text-[#e9edef] mt-2 capitalize">{lead.sentimiento_actual}</p>
          </div>
        </div>

        {/* Resumen de Interés */}
        <div className="bg-[#202c33] p-6 rounded-2xl border border-[#2a3942]">
          <p className="text-[#8696a0] text-xs font-bold uppercase tracking-widest mb-2">Resumen de Interés (IA)</p>
          <p className="text-[#e9edef] italic">"{lead.resumen_interes || 'Sin análisis aún'}"</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timeline */}
          <div className="bg-[#202c33] rounded-2xl border border-[#2a3942] overflow-hidden">
            <div className="p-5 border-b border-[#2a3942] bg-[#1c272d]">
              <h3 className="text-[#e9edef] font-bold flex items-center gap-2 text-sm">
                <Activity size={16} className="text-[#ffbc2d]" /> Línea de Tiempo
              </h3>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto custom-scrollbar">
              {activity.length === 0 ? (
                <p className="text-[#8696a0] text-xs italic text-center py-8">Sin actividad registrada aún</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {activity.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 p-1.5 bg-[#111b21] rounded-lg border border-[#2a3942]">
                        {getActivityIcon(item.tipo)}
                      </div>
                      <div className="flex-1">
                        <p className="text-[#e9edef] text-xs font-semibold">{item.detalle}</p>
                        <p className="text-[#54656f] text-[10px] flex items-center gap-1 mt-0.5">
                          <Clock size={10} /> {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Messages */}
          <div className="bg-[#202c33] rounded-2xl border border-[#2a3942] overflow-hidden">
            <div className="p-5 border-b border-[#2a3942] bg-[#1c272d]">
              <h3 className="text-[#e9edef] font-bold flex items-center gap-2 text-sm">
                <MessageCircle size={16} className="text-[#00a884]" /> Últimos Mensajes
              </h3>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto custom-scrollbar flex flex-col gap-2">
              {messages.length === 0 ? (
                <p className="text-[#8696a0] text-xs italic text-center py-8">Sin mensajes recientes</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`max-w-[85%] p-3 rounded-xl text-xs ${
                    msg.es_mio 
                      ? "bg-[#005c4b] text-[#e9edef] self-end rounded-br-sm" 
                      : "bg-[#1c272d] text-[#e9edef] self-start rounded-bl-sm border border-[#2a3942]"
                  }`}>
                    <p>{msg.mensaje_texto}</p>
                    <p className="text-[10px] text-[#8696a0] mt-1 text-right">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LeadDetail;
