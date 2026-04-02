import { useState, useEffect, useCallback, useRef } from "react";

import { useNavigate } from "react-router-dom";
import { UserPlus, Users as UsersIcon, Trash2, Mail, Lock, ChevronDown, Shield } from "lucide-react";
import { toast } from "react-hot-toast";

import { supabase } from "../lib/supabase";
import Layout from "../components/Layout";
import { useAuth } from "../context/auth-context";
import { type PlanId, canAccess, PLANS } from "../config/planConfig";

interface Profile {
  id: string;
  email: string;
  role: string;
  created_at: string;
  is_owner: boolean;
  empresa_id: string;
  empresas?: { nombre: string } | null;
}

type RoleOption = {
  value: string;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  is_owner: boolean;
};

const ROLE_OPTIONS: RoleOption[] = [
  { value: "agente", label: "Agente", emoji: "👨‍💻", color: "#00a884", bgColor: "#00a884", is_owner: false },
  { value: "dueno", label: "Dueño", emoji: "👑", color: "#a461d8", bgColor: "#a461d8", is_owner: true },
  { value: "super-admin", label: "Super Admin", emoji: "⚡", color: "#ffbc2d", bgColor: "#ffbc2d", is_owner: false },
];

function getRoleKey(profile: Profile): string {
  if (profile.role === "super-admin") return "super-admin";
  if (profile.is_owner) return "dueno";
  return "agente";
}

function getRoleOption(key: string): RoleOption {
  return ROLE_OPTIONS.find(r => r.value === key) || ROLE_OPTIONS[0];
}

// Inline dropdown component for changing roles
const RoleDropdown = ({
  profile,
  onRoleChange,
  disabled,
}: {
  profile: Profile;
  onRoleChange: (profileId: string, roleKey: string) => void;
  disabled: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentKey = getRoleKey(profile);
  const current = getRoleOption(currentKey);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all hover:brightness-125 disabled:opacity-60 disabled:cursor-default"
        style={{
          color: current.color,
          backgroundColor: `${current.bgColor}20`,
          border: `1px solid ${current.bgColor}30`,
        }}
      >
        <span>{current.emoji}</span>
        <span>{current.label}</span>
        {!disabled && <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-[#1c272d] border border-[#2a3942] rounded-xl shadow-2xl overflow-hidden min-w-[160px] animate-in fade-in slide-in-from-top-1">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onRoleChange(profile.id, opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold transition-colors ${
                opt.value === currentKey
                  ? "bg-[#2a3942]"
                  : "hover:bg-[#2a3942]/60"
              }`}
              style={{ color: opt.color }}
            >
              <span className="text-sm">{opt.emoji}</span>
              <span>{opt.label}</span>
              {opt.value === currentKey && (
                <span className="ml-auto text-[10px] text-[#8696a0]">Actual</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Users = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<{role: string, is_owner: boolean, empresa_id: string} | null>(null);
  const [planConfig, setPlanConfig] = useState<{limit: number} | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!session?.user.id) return;
      const { data: userProfile } = await supabase
        .from("perfiles_usuario")
        .select("role, empresa_id, is_owner")
        .eq("id", session.user.id)
        .single();
      
      if (!userProfile) {
        navigate("/dashboard");
        return;
      }
      
      // Failsafe: Si el usuario es el único en la empresa y tiene un plan de pago,
      // pero no es owner en la BD (por registros antiguos), lo tratamos como owner en el UI.
      if (!userProfile.is_owner && userProfile.role !== 'super-admin') {
        const { count } = await supabase.from("perfiles_usuario").select("id", { count: 'exact', head: true }).eq('empresa_id', userProfile.empresa_id);
        if (count === 1) {
            userProfile.is_owner = true;
            console.log("[Users] Único usuario detectado, asignando permisos de dueño temporalmente.");
        }
      }

      setCurrentUserProfile(userProfile);

      // El super-admin tiene acceso absoluto, el agente debe validar el plan de la empresa
      if (userProfile.role !== "super-admin") {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("plan")
          .eq("id", userProfile.empresa_id)
          .single();
        
        const rawPlan = (empresa?.plan || "gratis").toLowerCase();
        let planId: PlanId = "gratis";
        if (rawPlan.includes("pro")) planId = "pro";
        if (rawPlan.includes("enterprise") || rawPlan.includes("premium")) planId = "enterprise";
        
        if (!canAccess(planId, "usuarios")) {
          navigate("/dashboard");
          return;
        }
        setPlanConfig({ limit: PLANS[planId].limits.agentes });
        console.log("[Users] Plan detectado:", planId, "Límite:", PLANS[planId].limits.agentes);
      } else {
        setPlanConfig({ limit: 999 });
      }
    };
    checkAccess();
  }, [session, navigate]);

  const [nuevoAgenteEmail, setNuevoAgenteEmail] = useState("");
  const [nuevoAgentePass, setNuevoAgentePass] = useState("");
  const [nuevoAgenteRol, setNuevoAgenteRol] = useState("agente");
  const [creandoAgente, setCreandoAgente] = useState(false);

  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001/api/whatsapp";

  const baseApi = API_URL.includes('/chat/findChat') 
    ? API_URL.split('/chat/findChat')[0] 
    : API_URL;

  const fetchProfiles = useCallback(async () => {
    if (!currentUserProfile) return;
    
    setLoading(true);
    let query = supabase.from("perfiles_usuario").select("*, empresas(nombre)").order("created_at", { ascending: false });
    
    // Si no es super-admin, solo puede ver agentes de su misma empresa
    if (currentUserProfile.role !== 'super-admin') {
      query = query.eq('empresa_id', currentUserProfile.empresa_id);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching profiles:", error);
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  }, [currentUserProfile]);


  useEffect(() => {
    if (currentUserProfile) {
      fetchProfiles();
    }
  }, [currentUserProfile, fetchProfiles]);

  // Determinar qué opciones de rol mostrar en el formulario de creación
  const getCreateRoleOptions = (): RoleOption[] => {
    if (currentUserProfile?.role === 'super-admin') {
      return ROLE_OPTIONS; // Todas las opciones
    }
    // Dueño solo puede crear agentes
    return ROLE_OPTIONS.filter(r => r.value === 'agente');
  };

  const crearAgente = async () => {
    if (!nuevoAgenteEmail.trim() || !nuevoAgentePass.trim() || creandoAgente) return;
    setCreandoAgente(true);
    try {
      const selectedRole = getRoleOption(nuevoAgenteRol);
      
      const res = await fetch(`${baseApi}/admin/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: nuevoAgenteEmail.trim(), 
          password: nuevoAgentePass.trim(),
          role: nuevoAgenteRol === 'dueno' ? 'agente' : nuevoAgenteRol,
          is_owner: selectedRole.is_owner,
          creatorUserId: session?.user.id
        }),
      });

      if (res.ok) {
        // If role is "dueno", update the is_owner field via update-role after creation
        if (nuevoAgenteRol === 'dueno') {
          const userData = await res.json();
          const userId = userData?.user?.id;
          if (userId) {
            await fetch(`${baseApi}/admin/update-role/${userId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role: 'agente',
                is_owner: true,
                callerUserId: session?.user.id
              }),
            });
          }
        }
        toast.success(`¡${selectedRole.label} creado exitosamente!`);
        setNuevoAgenteEmail("");
        setNuevoAgentePass("");
        setNuevoAgenteRol("agente");
        fetchProfiles();
      } else {
        const errorData = await res.json();
        toast.error(`Error: ${errorData.error || 'No se pudo crear el agente'}`);
      }
    } catch (err) {
      console.error("Error creando agente:", err);
      toast.error("Error de conexión al servidor");
    } finally {

      setCreandoAgente(false);
    }
  };

  const cambiarRol = async (profileId: string, newRoleKey: string) => {
    const opt = getRoleOption(newRoleKey);
    
    try {
      const res = await fetch(`${baseApi}/admin/update-role/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: newRoleKey === 'dueno' ? 'agente' : newRoleKey,
          is_owner: opt.is_owner,
          callerUserId: session?.user.id
        }),
      });

      if (res.ok) {
        toast.success(`Rol actualizado a ${opt.emoji} ${opt.label}`);
        fetchProfiles();
      } else {
        const errorData = await res.json();
        toast.error(`Error: ${errorData.error || 'No se pudo actualizar el rol'}`);
      }
    } catch (err) {
      console.error("Error cambiando rol:", err);
      toast.error("Error de conexión al servidor");
    }
  };

  const borrarAgente = async (id: string, email: string) => {
    if (email === 'dev.ivanm@gmail.com') {
      toast.error("No puedes eliminar al Super Admin principal.");
      return;
    }


    if (!confirm(`¿Estás seguro de que quieres eliminar al agente ${email}? Esta acción borrará permanentemente sus chats y configuración.`)) return;

    try {
      const res = await fetch(`${baseApi}/admin/delete-user/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        toast.success("Agente eliminado correctamente");
        fetchProfiles();
      } else {
        const errorData = await res.json();
        toast.error(`Error: ${errorData.error || 'No se pudo eliminar el agente'}`);
      }
    } catch (err) {
      console.error("Error eliminando agente:", err);
      toast.error("Error de conexión al servidor");
    }

  };

  const isSuperAdmin = currentUserProfile?.role === 'super-admin';

  return (
    <Layout>
      <div className="p-4 sm:p-8 flex flex-col gap-6 sm:gap-8 bg-[#0b141a]">
        <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="bg-[#ffbc2d]/10 p-3 rounded-2xl shrink-0">
            <UsersIcon size={32} className="text-[#ffbc2d]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#e9edef]">Gestión de Agentes</h1>
            <p className="text-[#8696a0] text-xs sm:text-sm font-medium">
              {isSuperAdmin
                ? "Administra todos los usuarios del sistema" 
                : `Administra el equipo de tu empresa (${profiles.length} / ${planConfig?.limit === 999 ? '∞' : planConfig?.limit})`}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Formulario de creación (Solo Super-Admin o Dueño de Empresa) */}
          {(isSuperAdmin || currentUserProfile?.is_owner) && (
            <div className="lg:col-span-1">
              <div className="bg-[#202c33] p-5 sm:p-6 rounded-2xl border border-[#2a3942] lg:sticky lg:top-0 shadow-2xl">
              <h3 className="text-[#ffbc2d] font-bold mb-4 sm:mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
                <UserPlus size={18} /> Nuevo Agente
              </h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[#8696a0] text-xs font-bold uppercase tracking-widest ml-1">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-[#54656f]" />
                    <input
                      type="email"
                      placeholder="agente@ejemplo.com"
                      className="w-full bg-[#111b21] text-sm p-3 pl-10 rounded-xl border border-[#2a3942] text-[#e9edef] outline-none focus:border-[#ffbc2d] transition-all"
                      value={nuevoAgenteEmail}
                      onChange={(e) => setNuevoAgenteEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[#8696a0] text-xs font-bold uppercase tracking-widest ml-1">Contraseña</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-[#54656f]" />
                    <input
                      type="password"
                      placeholder="Minimum 6 caracteres"
                      className="w-full bg-[#111b21] text-sm p-3 pl-10 rounded-xl border border-[#2a3942] text-[#e9edef] outline-none focus:border-[#ffbc2d] transition-all"
                      value={nuevoAgentePass}
                      onChange={(e) => setNuevoAgentePass(e.target.value)}
                    />
                  </div>
                </div>

                {/* Selector de Rol */}
                <div className="flex flex-col gap-2">
                  <label className="text-[#8696a0] text-xs font-bold uppercase tracking-widest ml-1">Rol</label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-3 top-3 text-[#54656f] z-10 pointer-events-none" />
                    <select
                      value={nuevoAgenteRol}
                      onChange={(e) => setNuevoAgenteRol(e.target.value)}
                      className="w-full bg-[#111b21] text-sm p-3 pl-10 pr-8 rounded-xl border border-[#2a3942] text-[#e9edef] outline-none focus:border-[#ffbc2d] transition-all appearance-none cursor-pointer"
                    >
                      {getCreateRoleOptions().map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.emoji} {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-[#54656f] pointer-events-none" />
                  </div>
                  {nuevoAgenteRol !== 'agente' && (
                    <p className="text-[10px] ml-1 font-medium" style={{ color: getRoleOption(nuevoAgenteRol).color }}>
                      {nuevoAgenteRol === 'dueno' 
                        ? "⚠️ Este usuario será dueño de la empresa y podrá crear agentes"
                        : "⚠️ Este usuario tendrá acceso total al sistema"}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => void crearAgente()}
                  disabled={creandoAgente || !nuevoAgenteEmail.trim() || !nuevoAgentePass.trim()}
                  className="w-full bg-[#ffbc2d] text-[#111b21] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#e5a928] active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100 shadow-xl mt-2"
                >
                  {creandoAgente ? "CREANDO..." : `CREAR ${getRoleOption(nuevoAgenteRol).label.toUpperCase()}`}
                </button>
              </div>
              </div>
            </div>
          )}

          {/* Lista de usuarios */}
          <div className={(isSuperAdmin || currentUserProfile?.is_owner) ? "lg:col-span-2" : "lg:col-span-3"}>
            <div className="bg-[#202c33] rounded-2xl border border-[#2a3942] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-[#2a3942] bg-[#1c272d] flex items-center justify-between">
                <h3 className="text-[#e9edef] font-bold flex items-center gap-2">
                  <UsersIcon size={18} className="text-[#8696a0]" /> Equipo Actual
                </h3>
                {isSuperAdmin && (
                  <span className="text-[10px] text-[#ffbc2d] font-bold uppercase tracking-wider bg-[#ffbc2d]/10 px-2.5 py-1 rounded-lg border border-[#ffbc2d]/20">
                    ⚡ Modo Admin — Click en rol para cambiar
                  </span>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#111b21]">
                      <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Usuario</th>
                      <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Rol</th>
                      <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]">Fecha</th>
                      <th className="p-4 text-[#8696a0] text-xs font-bold uppercase tracking-widest border-b border-[#2a3942]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-[#8696a0] italic">Cargando equipo...</td>
                      </tr>
                    ) : profiles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-[#8696a0] italic">No hay agentes registrados</td>
                      </tr>
                    ) : (
                      profiles.map((profile) => {
                        const roleKey = getRoleKey(profile);
                        const roleOpt = getRoleOption(roleKey);
                        const isCurrentUser = profile.id === session?.user?.id;

                        return (
                          <tr key={profile.id} className="hover:bg-[#1c272d] transition-colors border-b border-[#2a3942]/50">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-[#e9edef] font-medium text-sm">{profile.email}</span>
                                <span className="text-[#8696a0] text-[10px] font-mono">{profile.id}</span>
                                {(isSuperAdmin && profile.empresas?.nombre) && (
                                  <span className="text-[#a461d8] text-[9px] font-bold mt-1 uppercase">🏢 {profile.empresas.nombre}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              {isSuperAdmin && !isCurrentUser ? (
                                <RoleDropdown
                                  profile={profile}
                                  onRoleChange={cambiarRol}
                                  disabled={false}
                                />
                              ) : (
                                <span
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide inline-flex items-center gap-1"
                                  style={{
                                    color: roleOpt.color,
                                    backgroundColor: `${roleOpt.bgColor}20`,
                                  }}
                                >
                                  {roleOpt.emoji} {roleOpt.label}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-[#8696a0] text-xs">
                              {new Date(profile.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              {/* Solo el Super Admin o el Dueño pueden eliminar agentes (y no a sí mismos ni otros dueños a menos que seas super-admin) */}
                              {((isSuperAdmin) || 
                                (currentUserProfile?.is_owner && profile.id !== session?.user?.id && !profile.is_owner)) && (
                                <button 
                                  onClick={() => void borrarAgente(profile.id, profile.email)}
                                  className="text-[#8696a0] hover:text-[#ea4335] transition-colors p-2"
                                  title="Eliminar Agente"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Users;
