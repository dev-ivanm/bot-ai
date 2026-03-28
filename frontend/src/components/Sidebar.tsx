import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  LogOut,
  Shield,
  TrendingUp,
  Lock,
  Crown,
  CreditCard,
  User
} from "lucide-react";
import { useAuth } from "../context/auth-context";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import NotificationBell from "./NotificationBell";
import { canAccess, type Feature, PLANS } from "../config/planConfig";

const Sidebar = () => {
  const { signOut, session, isPlanExpired, plan, role, isOwner, isTrial, vencimientoPlan, limits } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [usage, setUsage] = useState({ agentes: 1, memoria: 0 });
  const [pendingUpgrades, setPendingUpgrades] = useState(0);

  const calculateDaysLeft = (expiryDate: string | null) => {
    if (!expiryDate) return 0;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysLeft = calculateDaysLeft(vencimientoPlan);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return;

      // 1. Obtener solicitudes de upgrade (solo super-admin)
      if (role === 'super-admin') {
        try {
          const res = await fetch(`${BACKEND_URL}/api/whatsapp/admin/upgrade-requests`);
          if (res.ok) {
            const requests = await res.json();
            const pending = Array.isArray(requests) ? requests.filter((r: { estado: string }) => r.estado === 'pendiente').length : 0;
            setPendingUpgrades(pending);
          }
        } catch (err) {
          console.error("Error fetching upgrade requests:", err);
        }
      }

      // 2. Obtener uso de la empresa (contadores vía backend para saltar RLS)
      try {
        const res = await fetch(`${BACKEND_URL}/api/whatsapp/usage?userId=${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          setUsage({ 
            agentes: data.agentes || 1, 
            memoria: data.memoria || 0
          });
        }
      } catch (err) {
        console.error("Error fetching usage data:", err);
      }
    };

    fetchData();
  }, [session, role, BACKEND_URL]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socketUrl = BACKEND_URL.replace('/api/whatsapp', '');
    const socket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('[Sidebar] Socket conectado para métricas en tiempo real');
    });

    socket.on('memory_updated', () => {
      // Refrescar el uso cuando se notifica un cambio
      fetch(`${BACKEND_URL}/api/whatsapp/usage?userId=${session.user.id}`)
        .then(res => res.json())
        .then(data => {
          setUsage({ 
            agentes: data.agentes || 1, 
            memoria: data.memoria || 0
          });
        })
        .catch(err => console.error("Error recargando uso en tiempo real:", err));
    });

    return () => {
      socket.disconnect();
    };
  }, [session, BACKEND_URL]);


  const menuItems: { path: string; label: string; icon: React.ReactNode; feature: Feature }[] = [
    { path: "/dashboard", label: "Chats", icon: <MessageSquare size={20} />, feature: "chats" },
    { path: "/users", label: "Usuarios", icon: <Users size={20} />, feature: "usuarios" },
    { path: "/leads", label: "Leads / Ventas", icon: <TrendingUp size={20} />, feature: "leads" },
    { path: "/stats", label: "Estadísticas", icon: <BarChart3 size={20} />, feature: "stats" },
  ];

  const currentPlan = PLANS[plan];

  return (
    <aside className="w-64 bg-[#202c33] border-r border-[#2a3942] flex flex-col h-full overflow-hidden">
      <div className="p-6 flex items-center justify-between border-b border-[#2a3942]">
        <div className="flex items-center gap-3">
          {/* <div className="bg-[#00a884] p-2 rounded-lg">
            <Bot className="text-white" size={24} />
          </div> */}
          <h1 className="text-[#e9edef] font-bold text-lg tracking-tight">Bot AI</h1>
        </div>
        {role === "super-admin" && canAccess(plan, 'notificaciones') && <NotificationBell />}
      </div>

      {isPlanExpired && (
        <div className="bg-[#ea4335]/10 border-b border-[#ea4335]/20 p-4">
          <div className="flex items-center gap-2 text-[#ea4335] mb-2 font-bold text-[10px] uppercase tracking-wider">
            <Lock size={12} /> Plan Expirado
          </div>
          <button 
            onClick={() => navigate("/upgrade")}
            className="w-full bg-[#ea4335] text-white text-[10px] font-black py-2 rounded-lg hover:brightness-110 transition-all uppercase"
          >
            Renovar Ahora
          </button>
        </div>
      )}

      {!isPlanExpired && isTrial && (
        <div className="bg-[#a461d8]/10 border-b border-[#a461d8]/20 p-4">
          <div className="flex items-center gap-2 text-[#a461d8] mb-2 font-bold text-[10px] uppercase tracking-wider">
            <Crown size={12} /> Prueba PRO Activa
          </div>
          <p className="text-[#8696a0] text-[10px]">
            {daysLeft > 0 
              ? `Te quedan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} de acceso completo.` 
              : "Tu prueba PRO está por vencer."}
          </p>
        </div>
      )}

      <nav className="flex-1 p-4 flex flex-col gap-2 mt-4 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          // Super-admin tiene privilegios ilimitados, el Agente está sujeto al plan
          // Super-admin tiene privilegios ilimitados
          // El Agente está sujeto al plan y a la expiración (si expiró, solo chats)
          const hasAccess = role === "super-admin" 
            ? true 
            : isPlanExpired 
              ? item.feature === 'chats' 
              : canAccess(plan, item.feature);

          if (!hasAccess) {
            return (
              <button
                key={item.path}
                onClick={() => navigate("/upgrade")}
                className="flex items-center gap-4 px-4 py-3 rounded-lg transition-all text-[#54656f] hover:bg-[#2a3942]/50 group relative"
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
                <Lock size={14} className="ml-auto text-[#54656f] group-hover:text-[#ffbc2d] transition-colors" />
              </button>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all ${
                isActive 
                  ? "bg-[#2a3942] text-[#00a884] font-semibold shadow-lg" 
                  : "text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}

        {/* Link exclusivo super-admin: Gestión de Planes */}
        {role === 'super-admin' && (
          <Link
            to="/admin/planes"
            className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all ${
              location.pathname === '/admin/planes'
                ? "bg-[#2a3942] text-[#a461d8] font-semibold shadow-lg"
                : "text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"
            }`}
          >
            <CreditCard size={20} />
            <span className="text-sm">Gestión de Planes</span>
            {pendingUpgrades > 0 && (
              <span className="ml-auto bg-[#ea4335] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {pendingUpgrades}
              </span>
            )}
          </Link>
        )}

        <Link
          to="/profile"
          className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all ${
            location.pathname === '/profile'
              ? "bg-[#2a3942] text-[#00a884] font-semibold shadow-lg"
              : "text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"
          }`}
        >
          <User size={20} />
          <span className="text-sm">Mi Perfil</span>
        </Link>

        {/* Usage Counters y Upgrade Menu solo para Agentes */}
        {role === "agente" && (
          <>
            <div className="mt-4 px-4 flex flex-col gap-4">
              {/* Agentes */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[#8696a0] text-[10px] font-bold uppercase tracking-wider">
                  <span>Agentes</span>
                  <span className={usage.agentes >= limits.agentes ? "text-[#ea4335]" : ""}>
                    {usage.agentes} / {limits.agentes === 999 ? '∞' : limits.agentes}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#111b21] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${limits.agentes === 999 ? 100 : Math.min(100, (usage.agentes / limits.agentes) * 100)}%`,
                      backgroundColor: limits.agentes === 999 ? '#a461d8' : usage.agentes >= limits.agentes ? '#ea4335' : '#00a884'
                    }}
                  />
                </div>
              </div>
              
              {/* Memoria IA */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[#8696a0] text-[10px] font-bold uppercase tracking-wider">
                  <span>Memoria IA</span>
                  <span className={usage.memoria >= currentPlan.limits.memoria && currentPlan.limits.memoria > 0 ? "text-[#ea4335]" : ""}>
                    {usage.memoria} / {currentPlan.limits.memoria === 999 ? '∞' : currentPlan.limits.memoria === 0 ? '0' : currentPlan.limits.memoria}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#111b21] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${currentPlan.limits.memoria === 999 ? 100 : currentPlan.limits.memoria === 0 ? 0 : Math.min(100, (usage.memoria / currentPlan.limits.memoria) * 100)}%`,
                      backgroundColor: currentPlan.limits.memoria === 999 ? '#a461d8' : usage.memoria >= currentPlan.limits.memoria && currentPlan.limits.memoria > 0 ? '#ea4335' : '#00a884'
                    }}
                  />
                </div>
              </div>
            </div>

            {plan !== "enterprise" && (
              <div className="mt-4 px-2">
                <button
                  onClick={() => navigate("/upgrade")}
                  className="w-full bg-gradient-to-r from-[#a461d8]/10 to-[#7c3aed]/10 border border-[#a461d8]/20 p-4 rounded-xl hover:border-[#a461d8]/40 transition-all group text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Crown size={14} className="text-[#a461d8]" />
                    <span className="text-[#a461d8] text-[10px] font-black uppercase tracking-widest">Mejorar Plan</span>
                  </div>
                  <p className="text-[#8696a0] text-[10px] text-left">
                    Desbloquea {plan === "gratis" ? "IA, CRM y más features" : "Campañas IA y Scoring"}
                  </p>
                </button>
              </div>
            )}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-[#2a3942]">
        <div className="bg-[#111b21] p-4 rounded-xl mb-4 flex items-center gap-3">
          <div className="bg-[#2a3942] p-2 rounded-full">
            <Shield size={16} className={role === "super-admin" ? "text-[#ffbc2d]" : "text-[#8696a0]"} />
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-[#e9edef] text-xs font-bold truncate">{session?.user.email}</p>
            <div className="block items-center space-y-3">
              <p className="text-[#8696a0] text-[10px] uppercase font-semibold">{role}</p>
              {role === "agente" && (
                <span 
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1"
                  style={{ 
                    color: currentPlan.color, 
                    backgroundColor: `${currentPlan.color}15`,
                    border: `1px solid ${currentPlan.color}30`
                  }}
                >
                  {isOwner ? "👑 Dueño" : "👨‍💻 Agente"} | {currentPlan.emoji} {currentPlan.nombre}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={() => void signOut()}
          className="w-full flex items-center gap-4 px-4 py-3 text-[#ea4335] hover:bg-[#2a3942] rounded-lg transition-all"
        >
          <LogOut size={20} />
          <span className="text-sm font-semibold">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
