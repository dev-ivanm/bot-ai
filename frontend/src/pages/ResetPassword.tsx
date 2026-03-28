import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Lock, Loader2, Save, CheckCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar si el usuario tiene una sesión válida (proporcionada por el enlace de recuperación)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ 
          type: "error", 
          text: "El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo." 
        });
      }
    };
    checkSession();
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setMessage({
        type: "success",
        text: "Tu contraseña ha sido actualizada correctamente. Serás redirigido al inicio de sesión.",
      });

      // Redirigir después de 3 segundos
      setTimeout(() => {
        navigate("/login");
      }, 3000);

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
          <div className="bg-[#00a884] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00a884]/20">
            <Bot className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-[#e9edef] tracking-tight">Nueva Contraseña</h1>
          <p className="text-[#8696a0] mt-2">Establece tu nueva clave de acceso</p>
        </div>

        <div className="bg-[#111b21] p-8 rounded-2xl shadow-2xl border border-[#202c33]">
          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2 ${
              message.type === "success" 
                ? "bg-[#00a884]/10 border border-[#00a884]/20 text-[#00a884]" 
                : "bg-[#ea4335]/10 border border-[#ea4335]/20 text-[#ea4335]"
            }`}>
              {message.type === "success" ? <CheckCircle size={18} /> : null}
              <span className="font-bold">{message.type === "success" ? "Éxito:" : "Error:"}</span> {message.text}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-5">
            <div>
              <label className="block text-[#8696a0] text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                Nueva Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#202c33] text-[#e9edef] border border-transparent rounded-xl focus:border-[#00a884] focus:ring-0 outline-none transition-all placeholder:text-[#54656f]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[#8696a0] text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#202c33] text-[#e9edef] border border-transparent rounded-xl focus:border-[#00a884] focus:ring-0 outline-none transition-all placeholder:text-[#54656f]"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (message?.type === "error" && message.text.includes("link"))}
              className="w-full bg-[#00a884] text-[#111b21] py-4 rounded-xl font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider mt-2 shadow-lg shadow-[#00a884]/20"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>Actualizar Contraseña <Save size={18} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
