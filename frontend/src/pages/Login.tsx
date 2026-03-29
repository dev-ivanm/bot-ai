import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert("Error: " + error.message);
      } else {
        // Assuming successful login, you might want to navigate or update UI
        // The original snippet had navigate("/verify-email"); here, but it's usually for registration flow.
        // For login, you'd typically navigate to a dashboard or home page.
        // Since `navigate` is not defined, and the instruction is about fixing a link,
        // I'll keep the original error handling for now and not introduce navigation here.
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      alert(message); // Using alert as setError is not defined
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111b21] px-4">
      <div className="max-w-md w-full bg-[#202c33] p-8 rounded-lg shadow-2xl border-t-4 border-[#00a884]">
        <h2 className="text-2xl font-bold text-center text-[#e9edef] mb-8">
          Acceso Bot WhatsApp AI
        </h2>
        <p className="text-center text-[#e9edef] mb-8">Una Plataforma de Inteligencia Comercial</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Tu email"
            className="w-full p-3 bg-[#2a3942] text-[#e9edef] border-none rounded focus:ring-2 focus:ring-[#00a884] outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full p-3 bg-[#2a3942] text-[#e9edef] border-none rounded focus:ring-2 focus:ring-[#00a884] outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="text-right">
            <Link 
              to="/forgot-password" 
              className="text-sm text-[#00a884] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            disabled={loading}
            className="w-full bg-[#00a884] text-[#111b21] p-3 rounded-lg font-bold hover:bg-[#06cf9c] transition-all disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Entrar al Panel"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[#8696a0] text-sm">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="text-[#00a884] font-bold hover:underline ml-1">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
