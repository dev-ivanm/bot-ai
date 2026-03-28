import { useState, useEffect, useRef } from "react";
import { Bell, X, Zap, UserPlus, Megaphone, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/auth-context";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const API_URL = `${BACKEND_URL}/api/whatsapp`;

interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

const NotificationBell = () => {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!session?.user.id) return;
    try {
      const res = await fetch(`${API_URL}/notifications?userId=${session.user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const markAllRead = async () => {
    if (!session?.user.id) return;
    try {
      await fetch(`${API_URL}/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id })
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "lead_hot": return <Zap size={14} className="text-[#ff6b35]" />;
      case "lead_nuevo": return <UserPlus size={14} className="text-[#34b7f1]" />;
      case "campana_completada": return <Megaphone size={14} className="text-[#00a884]" />;
      case "cuota_limite": return <AlertTriangle size={14} className="text-[#ea4335]" />;
      default: return <Bell size={14} className="text-[#8696a0]" />;
    }
  };

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-[#2a3942] transition-all"
      >
        <Bell size={20} className={unreadCount > 0 ? "text-[#ffbc2d]" : "text-[#8696a0]"} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#ea4335] text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-[#202c33] rounded-2xl border border-[#2a3942] shadow-2xl z-50 overflow-hidden">
          <div className="p-4 border-b border-[#2a3942] bg-[#1c272d] flex items-center justify-between">
            <h3 className="text-[#e9edef] text-sm font-bold">Notificaciones</h3>
            <button onClick={() => setIsOpen(false)} className="text-[#8696a0] hover:text-[#ea4335]">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="text-[#2a3942] mx-auto mb-3" />
                <p className="text-[#8696a0] text-xs italic">Sin notificaciones</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-4 border-b border-[#2a3942]/50 hover:bg-[#1c272d] transition-colors cursor-default ${
                    !notif.leida ? "bg-[#111b21]/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 bg-[#111b21] rounded-lg border border-[#2a3942]">
                      {getIcon(notif.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#e9edef] text-xs font-bold">{notif.titulo}</p>
                      <p className="text-[#8696a0] text-[11px] mt-0.5 line-clamp-2">{notif.mensaje}</p>
                      <p className="text-[#54656f] text-[9px] mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notif.leida && (
                      <div className="w-2 h-2 bg-[#00a884] rounded-full mt-1.5 flex-shrink-0"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
