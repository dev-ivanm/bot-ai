import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/auth-context";
import { supabase } from "../lib/supabase";
import { 
  Crown, Check, X, Zap, ArrowRight, Send, Clock, CheckCircle, XCircle
} from "lucide-react";
import { PLANS, type PlanId } from "../config/planConfig";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

interface MyRequest {
  id: string;
  plan_solicitado: PlanId;
  estado: "pendiente" | "aprobada" | "rechazada";
  nota_admin: string | null;
  created_at: string;
}

const Upgrade = () => {
  const { session } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<PlanId>("gratis");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("pro");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myRequest, setMyRequest] = useState<MyRequest | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [hasEmpresa, setHasEmpresa] = useState<boolean | null>(null); // null = loading

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user.id) return;
      const { data: profile } = await supabase
        .from("perfiles_usuario")
        .select("empresa_id")
        .eq("id", session.user.id)
        .single();
      
      if (profile?.empresa_id) {
        setHasEmpresa(true);
        const { data: empresa } = await supabase
          .from("empresas")
          .select("plan")
          .eq("id", profile.empresa_id)
          .single();
        setCurrentPlan((empresa?.plan as PlanId) || "gratis");
      } else {
        setHasEmpresa(false);
      }

      // Cargar última solicitud del agente
      try {
        const res = await fetch(`${BACKEND_URL}/api/whatsapp/upgrade/my-request?userId=${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          setMyRequest(data);
        }
      } catch { /* silencioso */ }
    };
    fetchData();
  }, [session]);

  const handleSubmitRequest = async () => {
    if (!session?.user.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/upgrade/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          planSolicitado: selectedPlan,
          notas: notas.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Error al enviar solicitud", false);
        return;
      }
      setMyRequest(data);
      setShowRequestModal(false);
      setNotas("");
      showToast("✅ Solicitud enviada. El administrador la revisará pronto.", true);
    } catch {
      showToast("Error de conexión con el servidor", false);
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    { name: "Instancias WhatsApp", gratis: "1", pro: "3", enterprise: "∞" },
    { name: "Agentes", gratis: "1", pro: "5", enterprise: "∞" },
    { name: "Chats en Tiempo Real", gratis: true, pro: true, enterprise: true },
    { name: "Cerebro IA (Memoria)", gratis: false, pro: "10 entradas", enterprise: "∞" },
    { name: "Prompt Personalizado", gratis: false, pro: true, enterprise: true },
    { name: "CRM / Leads", gratis: false, pro: "Solo vista", enterprise: "Completo" },
    { name: "AI Lead Scoring", gratis: false, pro: false, enterprise: true },
    { name: "Campañas IA Masivas", gratis: false, pro: false, enterprise: true },
    { name: "Estadísticas", gratis: false, pro: "Básicas", enterprise: "Avanzadas" },
    { name: "Embudo de Ventas", gratis: false, pro: false, enterprise: true },
    { name: "Ranking de Agentes", gratis: false, pro: false, enterprise: true },
    { name: "Notificaciones", gratis: false, pro: false, enterprise: true },
  ];

  const renderCell = (value: boolean | string) => {
    if (value === true) return <Check size={16} className="text-[#00a884] mx-auto" />;
    if (value === false) return <X size={16} className="text-[#54656f] mx-auto" />;
    return <span className="text-[#e9edef] text-xs font-medium">{value}</span>;
  };

  const planOrder: PlanId[] = ["gratis", "pro", "enterprise"];

  const requestStatusBanner = () => {
    if (!myRequest) return null;
    const map = {
      pendiente: {
        icon: <Clock size={16} className="text-[#ffbc2d]" />,
        color: "#ffbc2d", bg: "#ffbc2d10", border: "#ffbc2d30",
        msg: `Tu solicitud de upgrade al plan ${PLANS[myRequest.plan_solicitado].nombre} está ⏳ pendiente de revisión.`,
      },
      aprobada: {
        icon: <CheckCircle size={16} className="text-[#00a884]" />,
        color: "#00a884", bg: "#00a88410", border: "#00a88430",
        msg: `✅ Tu upgrade al plan ${PLANS[myRequest.plan_solicitado].nombre} fue aprobado. ¡Disfruta tus nuevas funciones!`,
      },
      rechazada: {
        icon: <XCircle size={16} className="text-[#ea4335]" />,
        color: "#ea4335", bg: "#ea433510", border: "#ea433530",
        msg: `❌ Tu solicitud de upgrade fue rechazada.${myRequest.nota_admin ? ` Motivo: ${myRequest.nota_admin}` : ""}`,
      },
    };
    const s = map[myRequest.estado];
    return (
      <div
        className="flex items-center gap-3 p-4 rounded-xl border text-sm font-semibold max-w-5xl mx-auto w-full"
        style={{ backgroundColor: s.bg, borderColor: s.border, color: s.color }}
      >
        {s.icon}
        <span>{s.msg}</span>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-8 flex flex-col gap-8 flex-1 overflow-y-auto custom-scrollbar bg-[#0b141a]">

        {/* Toast */}
        {toast && (
          <div
            className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl font-bold text-sm border"
            style={{
              backgroundColor: toast.ok ? "#00a88420" : "#ea433520",
              color: toast.ok ? "#00a884" : "#ea4335",
              borderColor: toast.ok ? "#00a88440" : "#ea433540",
            }}
          >
            {toast.msg}
          </div>
        )}

        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#a461d8]/10 to-[#7c3aed]/10 border border-[#a461d8]/20 px-4 py-1.5 rounded-full mb-6">
            <Crown size={14} className="text-[#a461d8]" />
            <span className="text-[#a461d8] text-[10px] font-black uppercase tracking-widest">Planes &amp; Precios</span>
          </div>
          <h1 className="text-3xl font-black text-[#e9edef] mb-3">
            Potencia tu negocio con <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00a884] to-[#34b7f1]">Inteligencia Artificial</span>
          </h1>
          <p className="text-[#8696a0] text-sm">
            Elige el plan que mejor se adapte a tu empresa. Solicita el upgrade y un administrador lo activará tras verificar el pago.
          </p>
        </div>

        {/* Request status banner */}
        {requestStatusBanner()}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          {planOrder.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = currentPlan === planId;
            const isPopular = planId === "pro";
            const hasPendingRequest = myRequest?.estado === "pendiente";

            return (
              <div 
                key={planId}
                className={`relative bg-[#202c33] rounded-2xl border overflow-hidden transition-all hover:scale-[1.02] ${
                  isPopular 
                    ? "border-[#ffbc2d]/40 shadow-xl shadow-[#ffbc2d]/5" 
                    : "border-[#2a3942]"
                }`}
              >
                {isPopular && (
                  <div className="bg-gradient-to-r from-[#ffbc2d] to-[#ff9500] text-[#111b21] text-[10px] font-black uppercase tracking-widest text-center py-1.5">
                    ⭐ Más Popular
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{plan.emoji}</span>
                    <h3 className="text-[#e9edef] font-bold text-lg">{plan.nombre}</h3>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-black text-[#e9edef]">{plan.precio.split('/')[0]}</span>
                    {plan.precioNum > 0 && (
                      <span className="text-[#8696a0] text-sm">/mes</span>
                    )}
                  </div>

                  <ul className="flex flex-col gap-2.5 mb-6">
                    {plan.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-[#8696a0]">
                        <Check size={14} className="text-[#00a884] flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-3 rounded-xl text-center text-xs font-bold text-[#00a884] bg-[#00a884]/10 border border-[#00a884]/20">
                      ✓ Plan Actual
                    </div>
                  ) : !hasEmpresa ? (
                    <div className="w-full py-3 rounded-xl text-center text-xs font-bold text-[#54656f] bg-[#2a3942]/50 border border-[#2a3942] cursor-not-allowed">
                      Sin empresa asociada
                    </div>
                  ) : hasPendingRequest ? (
                    <div className="w-full py-3 rounded-xl text-center text-xs font-bold text-[#ffbc2d] bg-[#ffbc2d]/10 border border-[#ffbc2d]/20">
                      ⏳ Solicitud pendiente
                    </div>
                  ) : (
                    <button
                      onClick={() => { setSelectedPlan(planId); setShowRequestModal(true); }}
                      className={`w-full py-3 rounded-xl text-center text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        isPopular
                          ? "bg-gradient-to-r from-[#ffbc2d] to-[#ff9500] text-[#111b21] hover:brightness-110"
                          : planId === "enterprise"
                          ? "bg-gradient-to-r from-[#a461d8] to-[#7c3aed] text-white hover:brightness-110"
                          : "bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef]"
                      }`}
                    >
                      {planId === "gratis" ? "Downgrade" : "Solicitar Upgrade"} <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-[#202c33] rounded-2xl border border-[#2a3942] overflow-hidden shadow-2xl max-w-5xl mx-auto w-full">
          <div className="p-6 border-b border-[#2a3942] bg-[#1c272d]">
            <h3 className="text-[#e9edef] font-bold flex items-center gap-2">
              <Zap size={18} className="text-[#ffbc2d]" /> Comparación Completa
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#111b21]">
                  <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Función</th>
                  {planOrder.map(pid => (
                    <th key={pid} className="p-4 text-center border-b border-[#2a3942]">
                      <span className="text-xs font-bold" style={{ color: PLANS[pid].color }}>
                        {PLANS[pid].emoji} {PLANS[pid].nombre}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feat, i) => (
                  <tr key={i} className="border-b border-[#2a3942]/50 hover:bg-[#1c272d] transition-colors">
                    <td className="p-4 text-[#e9edef] text-xs font-medium">{feat.name}</td>
                    <td className="p-4 text-center">{renderCell(feat.gratis)}</td>
                    <td className="p-4 text-center">{renderCell(feat.pro)}</td>
                    <td className="p-4 text-center">{renderCell(feat.enterprise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-2xl border border-[#2a3942] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-[#2a3942] bg-[#1c272d] flex items-center justify-between">
              <h3 className="text-[#e9edef] font-bold flex items-center gap-2">
                <Send size={18} className="text-[#00a884]" /> Solicitar Upgrade
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-[#8696a0] hover:text-[#ea4335]">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="bg-[#111b21] p-4 rounded-xl border border-[#2a3942]/50 text-center">
                <span className="text-2xl">{PLANS[selectedPlan].emoji}</span>
                <p className="text-[#e9edef] font-bold mt-2">Plan {PLANS[selectedPlan].nombre}</p>
                <p className="text-3xl font-black mt-1" style={{ color: PLANS[selectedPlan].color }}>
                  {PLANS[selectedPlan].precio}
                </p>
              </div>

              <p className="text-[#8696a0] text-xs text-center leading-relaxed">
                Tu solicitud será enviada al administrador. Una vez verificado el pago, activará el plan automáticamente.
                Procesamos pagos por transferencia, Zinli, Zelle, PayPal o Binance.
              </p>

              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Nota opcional (ej: método de pago, referencia de transferencia, etc.)..."
                rows={3}
                className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl p-3 text-[#e9edef] text-sm placeholder-[#54656f] focus:outline-none focus:border-[#00a884]/50 resize-none"
              />

              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="w-full bg-gradient-to-r from-[#00a884] to-[#00c896] text-[#111b21] py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {submitting ? "Enviando solicitud..." : "Enviar Solicitud de Upgrade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Upgrade;
