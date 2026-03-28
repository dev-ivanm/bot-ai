import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/auth-context";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  CreditCard, CheckCircle, XCircle, Clock, RefreshCw,
  Building2, User, ArrowUpCircle, MessageSquare, X
} from "lucide-react";
import { PLANS, type PlanId } from "../config/planConfig";

interface UpgradeRequest {
  id: string;
  empresa_id: string;
  user_id: string;
  email_solicitante: string;
  plan_solicitado: PlanId;
  notas: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  nota_admin: string | null;
  created_at: string;
  procesado_at: string | null;
  empresas: { nombre: string; plan: PlanId } | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const estadoBadge = (estado: UpgradeRequest["estado"]) => {
  const map = {
    pendiente:  { color: "#ffbc2d", bg: "#ffbc2d15", label: "Pendiente",  icon: <Clock size={12} /> },
    aprobada:   { color: "#00a884", bg: "#00a88415", label: "Aprobada",   icon: <CheckCircle size={12} /> },
    rechazada:  { color: "#ea4335", bg: "#ea433515", label: "Rechazada",  icon: <XCircle size={12} /> },
  };
  const s = map[estado];
  return (
    <span
      className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}30` }}
    >
      {s.icon} {s.label}
    </span>
  );
};

const PlanManager = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | "pendiente" | "aprobada" | "rechazada">("pendiente");
  const [rejectModal, setRejectModal] = useState<{ id: string; email: string } | null>(null);
  const [notaAdmin, setNotaAdmin] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRequests = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/whatsapp/upgrade/requests?callerUserId=${session.user.id}`
      );
      if (res.status === 403) { navigate("/dashboard"); return; }
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      showToast("Error al cargar solicitudes", false);
    } finally {
      setLoading(false);
    }
  }, [session, navigate]);

  // Guard: only super-admin
  useEffect(() => {
    const check = async () => {
      if (!session?.user.id) return;
      const { data } = await supabase
        .from("perfiles_usuario")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (data?.role !== "super-admin") navigate("/dashboard");
    };
    check();
  }, [session, navigate]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (id: string, accion: "aprobar" | "rechazar", nota?: string) => {
    if (!session?.user.id) return;
    setProcessing(id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/upgrade/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerUserId: session.user.id, accion, notaAdmin: nota || null }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Error al procesar", false); return; }
      showToast(
        accion === "aprobar" ? "✅ Plan actualizado correctamente" : "❌ Solicitud rechazada",
        accion === "aprobar"
      );
      setRejectModal(null);
      setNotaAdmin("");
      fetchRequests();
    } catch {
      showToast("Error de conexión", false);
    } finally {
      setProcessing(null);
    }
  };

  const filtered = requests.filter(r => filter === "todas" || r.estado === filter);
  const pendingCount = requests.filter(r => r.estado === "pendiente").length;

  return (
    <Layout>
      <div className="p-8 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar bg-[#0b141a]">

        {/* Toast */}
        {toast && (
          <div
            className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl font-bold text-sm border transition-all"
            style={{
              backgroundColor: toast.ok ? "#00a88420" : "#ea433520",
              color: toast.ok ? "#00a884" : "#ea4335",
              borderColor: toast.ok ? "#00a88440" : "#ea433540",
            }}
          >
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="bg-[#a461d8]/10 p-3 rounded-2xl">
              <CreditCard size={32} className="text-[#a461d8]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#e9edef]">Gestión de Planes</h1>
              <p className="text-[#8696a0] text-sm">Revisa y procesa las solicitudes de upgrade de los agentes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="bg-[#ea4335] text-white text-xs font-black px-3 py-1.5 rounded-full animate-pulse">
                {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={fetchRequests}
              className="flex items-center gap-2 px-4 py-2 bg-[#202c33] border border-[#2a3942] text-[#8696a0] rounded-xl hover:text-[#e9edef] hover:border-[#38444d] transition-all text-sm font-semibold"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </header>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["pendiente", "aprobada", "rechazada", "todas"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                filter === f
                  ? "bg-[#a461d8]/20 text-[#a461d8] border-[#a461d8]/30"
                  : "bg-[#202c33] text-[#8696a0] border-[#2a3942] hover:border-[#38444d] hover:text-[#e9edef]"
              }`}
            >
              {f}
              {f === "pendiente" && pendingCount > 0 && (
                <span className="ml-1.5 bg-[#ea4335] text-white rounded-full px-1.5 py-0.5 text-[9px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Requests list */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#8696a0] animate-pulse italic">Cargando solicitudes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
            <div className="bg-[#202c33] p-6 rounded-2xl border border-[#2a3942]">
              <CreditCard size={40} className="text-[#2a3942] mx-auto" />
            </div>
            <p className="text-[#8696a0] font-semibold">No hay solicitudes {filter !== "todas" ? `con estado "${filter}"` : ""}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(req => {
              const planData = PLANS[req.plan_solicitado];
              const currentPlanData = PLANS[req.empresas?.plan || "gratis"];
              const isPending = req.estado === "pendiente";

              return (
                <div
                  key={req.id}
                  className={`bg-[#202c33] rounded-2xl border shadow-xl transition-all ${
                    isPending ? "border-[#ffbc2d]/30 hover:border-[#ffbc2d]/50" : "border-[#2a3942]"
                  }`}
                >
                  <div className="p-6 flex flex-col gap-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-[#8696a0]" />
                          <span className="text-[#e9edef] font-bold text-sm">
                            {req.empresas?.nombre || "Empresa sin nombre"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-[#54656f]" />
                          <span className="text-[#8696a0] text-xs">{req.email_solicitante}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {estadoBadge(req.estado)}
                        <span className="text-[#54656f] text-[10px]">
                          {new Date(req.created_at).toLocaleDateString("es", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Plan change visual */}
                    <div className="flex items-center gap-3 bg-[#111b21] p-4 rounded-xl">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-[#54656f] font-bold uppercase">Plan actual</span>
                        <span
                          className="text-sm font-black px-3 py-1 rounded-lg"
                          style={{ color: currentPlanData.color, backgroundColor: `${currentPlanData.color}15` }}
                        >
                          {currentPlanData.emoji} {currentPlanData.nombre}
                        </span>
                      </div>
                      <ArrowUpCircle size={20} className="text-[#a461d8] mx-2 flex-shrink-0" />
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-[#54656f] font-bold uppercase">Plan solicitado</span>
                        <span
                          className="text-sm font-black px-3 py-1 rounded-lg"
                          style={{ color: planData.color, backgroundColor: `${planData.color}15` }}
                        >
                          {planData.emoji} {planData.nombre}
                          <span className="ml-1 text-[10px] opacity-70">{planData.precio}</span>
                        </span>
                      </div>
                    </div>

                    {/* Notas del agente */}
                    {req.notas && (
                      <div className="flex items-start gap-2 bg-[#1c272d] p-3 rounded-xl border border-[#2a3942]/50">
                        <MessageSquare size={14} className="text-[#8696a0] mt-0.5 flex-shrink-0" />
                        <p className="text-[#8696a0] text-xs italic">"{req.notas}"</p>
                      </div>
                    )}

                    {/* Nota del admin (si aplicó) */}
                    {req.nota_admin && (
                      <div className="flex items-start gap-2 bg-[#1c272d] p-3 rounded-xl border border-[#2a3942]/50">
                        <MessageSquare size={14} className="text-[#a461d8] mt-0.5 flex-shrink-0" />
                        <p className="text-[#8696a0] text-xs">
                          <span className="text-[#a461d8] font-bold">Nota admin:</span> {req.nota_admin}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {isPending && (
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => handleAction(req.id, "aprobar")}
                          disabled={!!processing}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#00a884] to-[#00c896] text-[#111b21] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle size={16} />
                          {processing === req.id ? "Procesando..." : "✅ Aprobar Upgrade"}
                        </button>
                        <button
                          onClick={() => setRejectModal({ id: req.id, email: req.email_solicitante })}
                          disabled={!!processing}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ea4335]/10 text-[#ea4335] border border-[#ea4335]/30 font-bold text-sm hover:bg-[#ea4335]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XCircle size={16} />
                          ❌ Rechazar
                        </button>
                      </div>
                    )}

                    {req.procesado_at && (
                      <p className="text-[#54656f] text-[10px] text-right">
                        Procesado: {new Date(req.procesado_at).toLocaleDateString("es", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-2xl border border-[#ea4335]/30 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-[#2a3942] bg-[#1c272d] flex items-center justify-between">
              <h3 className="text-[#e9edef] font-bold flex items-center gap-2">
                <XCircle size={18} className="text-[#ea4335]" /> Rechazar Solicitud
              </h3>
              <button onClick={() => setRejectModal(null)} className="text-[#8696a0] hover:text-[#ea4335]">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-[#8696a0] text-sm">
                Vas a rechazar la solicitud de <strong className="text-[#e9edef]">{rejectModal.email}</strong>.
                Puedes dejar una nota opcional para el agente.
              </p>
              <textarea
                value={notaAdmin}
                onChange={e => setNotaAdmin(e.target.value)}
                placeholder="Motivo del rechazo (opcional)..."
                rows={3}
                className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl p-3 text-[#e9edef] text-sm placeholder-[#54656f] focus:outline-none focus:border-[#ea4335]/50 resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectModal(null)}
                  className="flex-1 py-3 rounded-xl bg-[#2a3942] text-[#8696a0] font-bold text-sm hover:text-[#e9edef] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleAction(rejectModal.id, "rechazar", notaAdmin)}
                  disabled={!!processing}
                  className="flex-1 py-3 rounded-xl bg-[#ea4335]/10 text-[#ea4335] border border-[#ea4335]/30 font-bold text-sm hover:bg-[#ea4335]/20 transition-all disabled:opacity-50"
                >
                  {processing ? "Rechazando..." : "Confirmar Rechazo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default PlanManager;
