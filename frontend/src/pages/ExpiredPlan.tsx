import { useNavigate } from "react-router-dom";
import { AlertTriangle, CreditCard, LogOut, MessageSquare } from "lucide-react";
import { useAuth } from "../context/auth-context";

const ExpiredPlan = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center px-4 font-sans">
      <div className="max-w-md w-full bg-[#111b21] p-8 rounded-2xl shadow-2xl border border-[#ea4335]/20 text-center relative overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#ea4335]/10 blur-[80px] -z-10"></div>

        {/* Icon */}
        <div className="w-20 h-20 bg-[#ea4335]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-[#ea4335]" size={40} />
        </div>

        {/* Text */}
        <h2 className="text-2xl font-black text-[#e9edef] mb-2 uppercase tracking-tight">Tu Plan ha Expirado</h2>
        <p className="text-[#8696a0] text-sm mb-8">
          Han pasado los 30 días de vigencia de tu plan actual. Para seguir usando las funciones avanzadas del Bot AI, por favor solicita una renovación.
        </p>

        {/* Actions */}
        <div className="space-y-4">
          <button
            onClick={() => navigate("/upgrade")}
            className="w-full bg-[#ea4335] text-white py-4 rounded-xl font-black text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ea4335]/20 uppercase tracking-widest"
          >
            Renovar Ahora <CreditCard size={18} />
          </button>

          <button
            onClick={() => window.open('https://wa.me/tu_numero', '_blank')}
            className="w-full bg-[#202c33] text-[#e9edef] py-4 rounded-xl font-bold text-sm hover:bg-[#2a3942] active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-[#2a3942]"
          >
            Contactar Soporte <MessageSquare size={18} />
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#2a3942] flex flex-col gap-4">
          <button
            onClick={() => navigate("/profile")}
            className="text-[#8696a0] hover:text-[#e9edef] text-xs font-medium transition-colors"
          >
            Ir a Mi Perfil
          </button>
          
          <button
            onClick={signOut}
            className="text-[#54656f] hover:text-[#ea4335] text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1"
          >
            <LogOut size={12} /> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiredPlan;
