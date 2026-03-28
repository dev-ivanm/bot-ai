import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, Send } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al solicitar recuperación");
      }

      setMessage({
        type: "success",
        text: "Si el correo está registrado, recibirás un enlace personalizado de Bot AI para restablecer tu contraseña en unos minutos.",
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b141a] px-4 font-sans">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          {/* <div className="bg-[#00a884] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00a884]/20">
            <Bot className="text-white" size={32} />
          </div> */}
          <h1 className="text-3xl font-black text-[#e9edef] tracking-tight">Recuperar Acceso</h1>
          <p className="text-[#8696a0] mt-2">Te enviaremos un enlace a tu correo</p>
        </div>

        <div className="bg-[#111b21] p-8 rounded-2xl shadow-2xl border border-[#202c33]">
          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2 ${
              message.type === "success" 
                ? "bg-[#00a884]/10 border border-[#00a884]/20 text-[#00a884]" 
                : "bg-[#ea4335]/10 border border-[#ea4335]/20 text-[#ea4335]"
            }`}>
              <span className="font-bold">{message.type === "success" ? "Hecho:" : "Error:"}</span> {message.text}
            </div>
          )}

          <form onSubmit={handleResetRequest} className="space-y-5">
            <div>
              <label className="block text-[#8696a0] text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]" size={18} />
                <input
                  type="email"
                  required
                  placeholder="nombre@empresa.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#202c33] text-[#e9edef] border border-transparent rounded-xl focus:border-[#00a884] focus:ring-0 outline-none transition-all placeholder:text-[#54656f]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00a884] text-[#111b21] py-4 rounded-xl font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider mt-2 shadow-lg shadow-[#00a884]/20"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>Enviar Enlace <Send size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#202c33] text-center">
            <Link to="/login" className="text-[#8696a0] text-sm hover:text-[#e9edef] inline-flex items-center gap-2 transition-colors">
              <ArrowLeft size={16} /> Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
