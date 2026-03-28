import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { Mail, ArrowRight, RefreshCw, CheckCircle2, AlertCircle, LogOut } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const VerifyEmail = () => {
  const { session, signOut, isVerified, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sentRef = useRef(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sendOTP = useCallback(async () => {
    if (!session?.user.id || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Error enviando el código");
      }
      const data = (await res.json()) as { message?: string };
      if (data.message) {
          setInfo(data.message);
          // Si ya está verificado, actualizar perfil y salir
          if (data.message.toLowerCase().includes("ya está verificado")) {
              await refreshProfile();
              setTimeout(() => navigate("/profile"), 1000);
          }
      }
      setCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setResending(false);
    }
  }, [session, cooldown]);

  useEffect(() => {
    if (!session) {
      navigate("/login");
      return;
    }
    if (isVerified) {
      navigate("/dashboard");
      return;
    }

    // Enviar OTP inicial solo una vez por montado de componente
    if (!sentRef.current) {
        sentRef.current = true;
        sendOTP();
    }
  }, [session, navigate, sendOTP]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user.id, code }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Código inválido o expirado");
      }
      setSuccess(true);
      
      // Actualizar el estado global de verificación en el context
      await refreshProfile();
      
      setTimeout(() => {
         navigate("/profile");
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b141a] px-4 font-sans">
      <div className="max-w-md w-full bg-[#111b21] p-8 rounded-2xl shadow-2xl border border-[#202c33] text-center">
        
        {/* Header */}
        <div className="mb-8">
          <div className="w-16 h-16 bg-[#00a884]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="text-[#00a884]" size={32} />
          </div>
          <h2 className="text-2xl font-black text-[#e9edef] mb-2">Verifica tu correo</h2>
          <p className="text-[#8696a0] text-sm">
            Hemos enviado un código de 6 dígitos a <br />
            <span className="text-[#e9edef] font-bold">{session?.user.email}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-between gap-2">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={loading || success}
                className="w-12 h-14 bg-[#202c33] border-2 border-transparent rounded-xl text-center text-xl font-bold text-[#e9edef] focus:border-[#00a884] focus:outline-none transition-all disabled:opacity-50"
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[#ea4335] text-xs bg-[#ea4335]/10 p-3 rounded-lg justify-center">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-[#00a884] text-xs bg-[#00a884]/10 p-3 rounded-lg justify-center animate-bounce">
              <CheckCircle2 size={14} />
              <span>¡Código verificado con éxito!</span>
            </div>
          )}

          {info && !error && !success && (
            <div className="flex items-center gap-2 text-[#34b7f1] text-xs bg-[#34b7f1]/10 p-3 rounded-lg justify-center">
              <RefreshCw size={14} className="animate-spin" />
              <span>{info}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success || otp.join("").length < 6}
            className="w-full bg-[#00a884] text-[#111b21] py-4 rounded-xl font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider shadow-lg shadow-[#00a884]/20"
          >
            {loading ? "Verificando..." : "Confirmar Código"} <ArrowRight size={18} />
          </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-8 flex flex-col gap-4">
          <button
            onClick={sendOTP}
            disabled={cooldown > 0 || resending}
            className="text-[#8696a0] hover:text-[#00a884] text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {resending ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : cooldown > 0 ? (
              `Reenviar en ${cooldown}s`
            ) : (
              "¿No recibiste el código? Reenviar"
            )}
          </button>

          <button
            onClick={signOut}
            className="text-[#54656f] hover:text-[#ea4335] text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1 mt-4"
          >
            <LogOut size={12} /> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
