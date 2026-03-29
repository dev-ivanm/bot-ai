import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";

import { supabase } from "../lib/supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const translateError = (msg: string) => {
    if (msg.includes("User already registered") || msg.includes("already exists")) return "El usuario ya está registrado";
    if (msg.includes("Email not confirmed")) return "Por favor, confirma tu correo electrónico";
    if (msg.includes("Password should be at least")) return "La contraseña debe tener al menos 6 caracteres";
    if (msg.includes("Database error")) return "Error de base de datos";
    return msg;
  };


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);


    try {
      // Llamar a nuestro endpoint personalizado que crea todo (Auth + Empresa + Perfil)
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nombreCompleto }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al registrarse");
      }

      // Después de registrarse exitosamente en el backend, 
      // Supabase signUp suele iniciar sesión automáticamente si no requiere confirmación de link.
      // Intentamos hacer login para obtener la sesión y pasar a verificación
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      // Redirigir a verificación
      navigate("/verify-email");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(translateError(message));
    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b141a] px-4 font-sans">
      <div className="max-w-md w-full">
        {/* Logo Section */}
        <div className="text-center mb-8">
          {/* <div className="bg-[#00a884] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00a884]/20">
            <Bot className="text-white" size={32} />
          </div> */}
          <h1 className="text-3xl font-black text-[#e9edef] tracking-tight">Crea tu cuenta</h1>
          <p className="text-[#8696a0] mt-2">Empieza tu prueba PRO de 7 días gratis</p>
        </div>

<div className="bg-[#111b21] p-8 rounded-2xl shadow-2xl border border-[#202c33]">


          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-[#8696a0] text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                Nombre Completo
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]" size={18} />
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#202c33] text-[#e9edef] border border-transparent rounded-xl focus:border-[#00a884] focus:ring-0 outline-none transition-all placeholder:text-[#54656f]"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                />
              </div>
            </div>

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

            <div>
              <label className="block text-[#8696a0] text-xs font-bold uppercase tracking-widest mb-2 ml-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]" size={18} />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#202c33] text-[#e9edef] border border-transparent rounded-xl focus:border-[#00a884] focus:ring-0 outline-none transition-all placeholder:text-[#54656f]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00a884] text-[#111b21] py-4 rounded-xl font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider mt-4 shadow-lg shadow-[#00a884]/20"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>Crear Cuenta <ArrowRight size={20} /></>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#202c33] text-center">
            <p className="text-[#8696a0] text-sm">
              ¿Ya tienes una cuenta?{" "}
              <Link to="/login" className="text-[#00a884] font-bold hover:underline ml-1">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-[#54656f] text-[10px] mt-6 leading-relaxed">
          Al registrarte, aceptas nuestros Términos de Servicio y <br /> Política de Privacidad. Prueba PRO válida por 7 días.
        </p>
      </div>
    </div>
  );
};

export default Register;
