import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { toast } from "react-hot-toast";
import Layout from "../components/Layout";

import { 
  User, 
  Building2, 
  Save, 
  Loader2, 
  Phone, 
  CheckCircle2, 
  ShieldCheck,
  Building
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const Profile = () => {
  const { session, hasEmpresa, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tipoCuenta, setTipoCuenta] = useState<"empresa" | "persona">("empresa");
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [nombrePersonal, setNombrePersonal] = useState("");
  const [telefonoEmpresa, setTelefonoEmpresa] = useState("");
  const [telefonoPersonal, setTelefonoPersonal] = useState("");
  const [success, setSuccess] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/profile/me?userId=${session?.user.id}`);
      if (!res.ok) throw new Error("Error fetching profile");
      const data = await res.json();
      
      if (data.profile) {
        const t = data.profile.tipo_cuenta || "empresa";
        setTipoCuenta(t);
        
        // Cargar datos personales
        setNombrePersonal(data.profile.nombre_display || "");
        setTelefonoPersonal(data.profile.telefono || "");

        // Cargar datos de empresa
        const eNombre = data.empresa?.nombre || "";
        const eTelefono = data.empresa?.telefono || "";

        // Si es cuenta personal y el nombre de la empresa es igual al personal o está vacío, 
        // lo tratamos como "empresa no rellena" en el UI.
        if (t === "persona") {
          setNombreEmpresa(eNombre === data.profile.nombre_display ? "" : eNombre);
          setTelefonoEmpresa(eTelefono);
        } else {
          setNombreEmpresa(eNombre);
          setTelefonoEmpresa(eTelefono);
        }
        
        // Si no tiene empresa_id, es onboarding mandatorio
        if (!data.profile.empresa_id) {
          setIsNewUser(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (isNewUser && hasEmpresa) {
      navigate("/dashboard");
      return;
    }
    fetchProfile();
  }, [session, fetchProfile, isNewUser, hasEmpresa, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreActivo = tipoCuenta === "empresa" ? nombreEmpresa : nombrePersonal;
    const telefonoActivo = tipoCuenta === "empresa" ? telefonoEmpresa : telefonoPersonal;
    if (!nombreActivo || !tipoCuenta) return;

    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/profile/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user.id,
          nombre: nombreActivo,
          tipo_cuenta: tipoCuenta,
          telefono: telefonoActivo
        }),
      });

      if (!res.ok) throw new Error("Error al guardar perfil");
      
      setSuccess(true);
      
      // Actualizar el estado global para que ProtectedRoute vea que ya tiene empresa
      await refreshProfile();

      setTimeout(() => {
        setSuccess(false);
        if (isNewUser) {
           navigate("/");
        }
      }, 2000);
    } catch (err) {
      toast.error("Error al guardar perfil: " + (err as Error).message);
    } finally {

      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#00a884]" size={32} />
      </div>
    );
  }

  return (
    <Layout>
      <div className="flex-1 p-8 bg-[#0b141a] overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#00a884]/20 rounded-xl flex items-center justify-center">
                <User className="text-[#00a884]" size={24} />
              </div>
              <h1 className="text-3xl font-black text-[#e9edef]">Tu Perfil</h1>
            </div>
            <p className="text-[#8696a0] text-sm">
                {isNewUser 
                    ? "Completa tu información inicial para comenzar a usar la plataforma." 
                    : "Gestiona tu información personal y de empresa."}
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Account Type Selection */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setTipoCuenta("empresa")}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                  tipoCuenta === "empresa" 
                    ? "bg-[#00a884]/10 border-[#00a884] text-[#00a884]" 
                    : "bg-[#202c33] border-transparent text-[#8696a0] hover:bg-[#2a3942]"
                }`}
              >
                <Building2 size={32} />
                <div className="text-center">
                  <p className="font-bold text-sm">Empresa</p>
                  <p className="text-[10px] opacity-60">Ideal para negocios con equipos</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTipoCuenta("persona")}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                  tipoCuenta === "persona" 
                    ? "bg-[#34b7f1]/10 border-[#34b7f1] text-[#34b7f1]" 
                    : "bg-[#202c33] border-transparent text-[#8696a0] hover:bg-[#2a3942]"
                }`}
              >
                <User size={32} />
                <div className="text-center">
                  <p className="font-bold text-sm">Personal</p>
                  <p className="text-[10px] opacity-60">Uso individual o marca personal</p>
                </div>
              </button>
            </div>

            {/* Inputs Section */}
            <div className="bg-[#111b21] p-8 rounded-2xl border border-[#202c33] space-y-6">
              
              <div className="space-y-2">
                <label className="text-[#8696a0] text-xs font-bold uppercase tracking-wider">
                  {tipoCuenta === "empresa" ? "Nombre de la Empresa" : "Nombre Completo"}
                </label>
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]">
                        {tipoCuenta === "empresa" ? <Building size={18} /> : <User size={18} />}
                    </div>
                    <input
                        type="text"
                        placeholder={tipoCuenta === "empresa" ? "Ej: ABIM Soluciones S.A." : "Ej: Juan Pérez"}
                        className="w-full bg-[#202c33] border border-transparent rounded-xl py-4 pl-12 pr-4 text-[#e9edef] text-sm focus:border-[#00a884] outline-none transition-all placeholder:text-[#54656f]"
                        value={tipoCuenta === "empresa" ? nombreEmpresa : nombrePersonal}
                        onChange={(e) => tipoCuenta === "empresa" ? setNombreEmpresa(e.target.value) : setNombrePersonal(e.target.value)}
                        required
                    />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[#8696a0] text-xs font-bold uppercase tracking-wider">
                  Teléfono de Contacto
                </label>
                <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]">
                        <Phone size={18} />
                    </div>
                    <input
                        type="tel"
                        placeholder="Ej: +58 412 1234567"
                        className="w-full bg-[#202c33] border border-transparent rounded-xl py-4 pl-12 pr-4 text-[#e9edef] text-sm focus:border-[#00a884] outline-none transition-all placeholder:text-[#54656f]"
                        value={tipoCuenta === "empresa" ? telefonoEmpresa : telefonoPersonal}
                        onChange={(e) => tipoCuenta === "empresa" ? setTelefonoEmpresa(e.target.value) : setTelefonoPersonal(e.target.value)}
                    />
                </div>
              </div>

              <div className="space-y-2 opacity-50">
                <label className="text-[#8696a0] text-xs font-bold uppercase tracking-wider">
                  Correo Electrónico
                </label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f]">
                        <ShieldCheck size={18} />
                    </div>
                    <input
                        type="email"
                        disabled
                        className="w-full bg-[#1c272d] border border-transparent rounded-xl py-4 pl-12 pr-4 text-[#8696a0] text-sm cursor-not-allowed"
                        value={session?.user.email}
                    />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !(tipoCuenta === "empresa" ? nombreEmpresa : nombrePersonal)}
                className="bg-[#00a884] text-[#111b21] px-8 py-4 rounded-xl font-black text-sm flex items-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider shadow-lg shadow-[#00a884]/20"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                {isNewUser ? "Finalizar Configuración" : "Guardar Cambios"}
              </button>
            </div>

            {success && (
                <div className="flex items-center gap-3 bg-[#00a884]/10 border border-[#00a884]/20 p-4 rounded-xl text-[#00a884] animate-in fade-in slide-in-from-top-2 duration-300">
                    <CheckCircle2 size={20} />
                    <span className="text-sm font-bold">¡Perfil actualizado correctamente!</span>
                </div>
            )}
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
