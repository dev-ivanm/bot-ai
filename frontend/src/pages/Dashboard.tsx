import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { io, Socket } from "socket.io-client";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/auth-context";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import Layout from "../components/Layout";
import {
  LogOut,
  QrCode,
  Bot,
  RefreshCw,
  Save,
  MessageSquare,
  Send,
  Trash2,
  Plus,
  BookOpen,
  X
  // Power
} from "lucide-react";

interface PerfilBot {
  id: string;
  email: string;
  instance_name: string;
  prompt_sistema: string;
}

interface MemoryEntry {
  id: string;
  contenido: string;
}

interface PresencePayload {
  instance: string;
  data: {
    id: string;
    presences: Record<string, { lastKnownPresence: string }>;
  };
}

interface NewMessagePayload {
  instance: string;
  message: Message;
}

interface ChatDeletePayload {
  instance: string;
  data: string[]; // Evolution API envía un array de JIDs en CHATS_DELETE
}

interface Chat {
  id: string;
  contact?: {
    name?: string;
  };
  lastMessage?: {
    message?: {
      conversation?: string;
    };
  };
}

interface Message {
  id: string;
  fromMe: boolean;
  sender: string;
  text: string;
  timestamp: string;
  remoteJid?: string;
}

const Dashboard = () => {
  const { session, profileLoading, hasSeenTutorial, completeTutorial } = useAuth();
  const [perfil, setPerfil] = useState<PerfilBot | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nuevoPrompt, setNuevoPrompt] = useState("");
  const [status, setStatus] = useState<string>("Desconectado");
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatSeleccionado, setChatSeleccionado] = useState<Chat | null>(null);
  const [mensajes, setMensajes] = useState<Message[]>([]);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [inputMensaje, setInputMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [typingChatId, setTypingChatId] = useState<string | null>(null);
  const [nuevoConocimiento, setNuevoConocimiento] = useState("");
  const [memoria, setMemoria] = useState<MemoryEntry[]>([]);
  const [cargandoMemoria, setCargandoMemoria] = useState(false);
  const [guardandoMemoria, setGuardandoMemoria] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [showCerebroModal, setShowCerebroModal] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const tutorialStarted = useRef(false);

  // Ref para auto-scroll al final del chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
  const API_URL = `${BACKEND_URL}/api/whatsapp`;

  // Usamos useCallback para poder llamarlo dentro de useEffect sin warnings
  const cargarChats = useCallback(
    async (name?: string) => {
      // Intentamos sacar el name del argumento, si no existe o es vacío, lo calculamos
      const currentInstanceName = name || perfil?.instance_name || (session?.user.id ? `bot-${session.user.id.substring(0, 5)}` : null);

      if (!currentInstanceName || currentInstanceName === 'bot-undefined') {
        console.log("cargarChats: No instance name available yet");
        return;
      }

      try {
        console.log("cargarChats: Fetching for", currentInstanceName);
        const res = await fetch(`${API_URL}/chat/findChat/${currentInstanceName}`, {
          method: 'POST'
        });

        if (!res.ok) throw new Error("Server error");

        const data = await res.json() as Chat[] | { chats?: Chat[]; data?: Chat[] };
        const newChats = Array.isArray(data) ? data : (data.chats || data.data || []);

        console.log("CHATS SYNC:", newChats.length, "chats found");

        setChats(prevChats => {
          // Si recibimos chats, los actualizamos
          if (newChats.length > 0) return newChats;
          // Si recibimos vacío pero ya teníamos chats, mantenemos los anteriores 
          // (esto evita el parpadeo si una petición falla o devuelve vacío momentáneamente)
          if (prevChats.length > 0) return prevChats;
          // Si no teníamos nada y recibimos vacío, se queda vacío
          return [];
        });
      } catch (err: unknown) {
        console.error("Error cargando chats:", err);
      }
    },
    [API_URL, perfil?.instance_name, session?.user.id],
  );

  const fetchQR = useCallback(
    async (instanceName: string) => {
      try {
        setStatus(prev => prev.includes("Conectado") ? prev : "Consultando QR...");
        const res = await fetch(`${API_URL}/instance/connect/${instanceName}`);
        const data = await res.json();

        if (data.base64) {
          setQr(data.base64);
          setStatus("Listo para escanear");
        } else if (data.instance?.state === "open") {
          setStatus("Conectado ✅");
          setQr(null);
          cargarChats(instanceName);
        }
      } catch {
        setStatus("Error de conexión");
      }
    },
    [API_URL, cargarChats],
  );

  const fetchMessages = useCallback(
    async (chat: Chat) => {
      const instanceName = perfil?.instance_name || `bot-${session?.user.id.substring(0, 5)}`;
      if (!instanceName || instanceName === 'bot-undefined') {
        console.error("fetchMessages: No instanceName available");
        return;
      }
      console.log("fetchMessages: Fetching for", chat.id, "on instance", instanceName);
      setCargandoMensajes(true);
      try {
        const res = await fetch(`${API_URL}/chat/findMessages/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remoteJid: chat.id })
        });
        const data = await res.json() as Message[];
        console.log("MESSAGES RESPONSE:", data);
        // Los recibimos ya ordenados cronológicamente desde el backend
        setMensajes(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        console.error("Error cargando mensajes:", err);
        toast.error("Error al cargar mensajes");
        setMensajes([]);
      }
      setCargandoMensajes(false);
    },
    [API_URL, perfil, session],
  );

  // Trigger automático al cambiar de chat
  useEffect(() => {
    if (chatSeleccionado) {
      void fetchMessages(chatSeleccionado);
    }
  }, [chatSeleccionado, fetchMessages]);

  const handleEnviar = async () => {
    if (!inputMensaje.trim() || !chatSeleccionado || enviando) return;

    const instanceName = perfil?.instance_name || `bot-${session?.user.id.substring(0, 5)}`;
    setEnviando(true);

    try {
      const res = await fetch(`${API_URL}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: chatSeleccionado.id,
          text: inputMensaje.trim()
        }),
      });

      if (res.ok) {
        setInputMensaje("");
        // No hace falta agregarlo manualmente al estado si Socket.io funciona,
        // pero Evolution API no siempre dispara el upsert del 'fromMe' inmediatamente.
        // Lo agregamos para feedback instantáneo.
        const msgPropio: Message = {
          id: 'sent-' + Date.now(),
          fromMe: true,
          sender: 'Tú',
          text: inputMensaje.trim(),
          timestamp: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
        };
        setMensajes(prev => [...prev, msgPropio]);
        scrollToBottom();
        // Forzar actualización inmediata de la lista de chats para ver el previo actualizado
        void cargarChats();
      } else {
        toast.error("Error al enviar mensaje");
      }
    } catch (err: unknown) {
      console.error("Error enviando:", err);
      toast.error("Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  const manejarConexionTotal = async () => {
    const instanceName =
      perfil?.instance_name || `bot-${session?.user.id.substring(0, 5)}`;
    try {
      setStatus("Iniciando instancia...");

      const resCreate = await fetch(`${API_URL}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });

      if (!resCreate.ok) {
        const errorMsg = await resCreate.text();
        console.error("Error del servidor:", errorMsg);
        setStatus("Error al crear instancia");
        toast.error("Error al iniciar instancia");
        return;
      }

      setStatus("Instancia lista. Generando QR...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await fetchQR(instanceName);

      // Configurar Webhook Global hacia Supabase como solicitó el usuario
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      if (SUPABASE_URL) {
        void fetch(`${API_URL}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `${SUPABASE_URL}/functions/v1/whatsapp-webhook`,
            enabled: true,
            events: ["MESSAGES_UPSERT", "CONTACTS_UPSERT"]
          })
        });
      }

      // Mantener también la configuración del backend local por si acaso para Socket.io
      void fetch(`${API_URL}/instance/setup-webhook/${instanceName}`, { method: 'POST' });
    } catch {
      toast.error("Error de conexión");
    }
  };

  // const manejarDesconexion = async () => {
  //   if (!perfil?.instance_name) return;

  //   const confirm = window.confirm("¿Estás seguro que deseas desconectar WhatsApp? Tendrás que volver a escanear el QR.");
  //   if (!confirm) return;

  //   try {
  //     setStatus("Desconectando...");
  //     const res = await fetch(`${API_URL}/instance/logout/${perfil.instance_name}`, {
  //       method: 'DELETE'
  //     });

  //     if (res.ok) {
  //       setStatus("Desconectado");
  //       setQr(null);
  //       // Opcional: Eliminar la instancia en el local también si se desea
  //       await fetch(`${API_URL}/instance/delete/${perfil.instance_name}`, {
  //         method: 'DELETE'
  //       });

  //       // Refrescar para limpiar todo
  //       window.location.reload();
  //     } else {
  //       alert("Error al intentar desconectar la instancia.");
  //       setStatus("Error de conexión");
  //     }
  //   } catch (err: unknown) {
  //     console.error(err);
  //     alert("Error de red al desconectar.");
  //   }
  // };

  const guardarConfiguracion = async () => {
    if (!session?.user.id) return;
    const instanceName =
      perfil?.instance_name || `bot-${session?.user.id.substring(0, 5)}`;

    try {
      // Simplificamos la URL para evitar errores de path
      const baseApi = API_URL.includes('/chat/findChat')
        ? API_URL.split('/chat/findChat')[0]
        : API_URL;

      const res = await fetch(`${baseApi}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: session.user.id,
          email: session.user.email,
          prompt_sistema: nuevoPrompt.trim(),
          instance_name: instanceName,
        }),
      });

      if (res.ok) {
        const updatedData = (await res.json()) as PerfilBot;
        setPerfil(updatedData);
        toast.success("¡IA Actualizada!");
      } else {
        toast.error("Error al guardar");
      }
    } catch (err: unknown) {
      console.error("Error guardando config:", err);
      toast.error("Error de conexión");
    }
  };

  const cargarMemoria = useCallback(async () => {
    if (!session?.user.id) return;
    setCargandoMemoria(true);
    try {
      const baseApi = API_URL.includes('/chat/findChat')
        ? API_URL.split('/chat/findChat')[0]
        : API_URL;
      const res = await fetch(`${baseApi}/memory?userId=${session.user.id}`);
      if (res.ok) {
        const data = (await res.json()) as MemoryEntry[];
        setMemoria(data);
      }
    } catch (err: unknown) {
      console.error("Error cargando memoria:", err);
      toast.error("Error al cargar memoria");
    } finally {
      setCargandoMemoria(false);
    }
  }, [API_URL, session?.user.id]);

  const agregarMemoria = async () => {
    if (!nuevoConocimiento.trim() || guardandoMemoria) return;
    setGuardandoMemoria(true);
    try {
      const baseApi = API_URL.includes('/chat/findChat')
        ? API_URL.split('/chat/findChat')[0]
        : API_URL;
      const res = await fetch(`${baseApi}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contenido: nuevoConocimiento.trim(),
          userId: session?.user.id
        }),
      });
      if (res.ok) {
        setNuevoConocimiento("");
        toast.success("Respuesta guardada");
        await cargarMemoria();
      }
    } catch (err: unknown) {
      console.error("Error agregando memoria:", err);
      toast.error("Error al agregar respuesta");
    } finally {
      setGuardandoMemoria(false);
    }
  };

  const borrarMemoria = async (id: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">¿Seguro que quieres borrar esta respuesta?</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1 text-xs bg-[#2a3942] text-[#e9edef] rounded-md hover:bg-[#34444e] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const baseApi = API_URL.includes('/chat/findChat')
                  ? API_URL.split('/chat/findChat')[0]
                  : API_URL;
                const res = await fetch(`${baseApi}/memory/${id}?userId=${session?.user.id}`, { method: "DELETE" });
                if (res.ok) {
                  toast.success("Respuesta eliminada");
                  await cargarMemoria();
                } else {
                  toast.error("No se pudo eliminar la respuesta");
                }
              } catch (err: unknown) {
                console.error("Error borrando memoria:", err);
                toast.error("Error al eliminar dato");
              }
            }}
            className="px-3 py-1 text-xs bg-[#ea4335] text-white rounded-md hover:bg-[#d93025] transition-colors font-bold"
          >
            Eliminar
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      id: `confirm-delete-${id}`,
    });
  };


  useEffect(() => {
    void cargarMemoria();
  }, [cargarMemoria]);

  useEffect(() => {
    const init = async () => {
      if (!session?.user.id) return;
      setLoading(true);

      try {
        // 1) Buscar perfil existente vía Backend (evita 403 RLS)
        let data: PerfilBot | null = null;
        try {
          const resProf = await fetch(`${API_URL.replace('/chat/findChat', '')}/profile/${session.user.id}`);
          data = (await resProf.json()) as PerfilBot;
        } catch (err: unknown) {
          console.error("Error cargando perfil:", err);
          toast.error("Error al cargar perfil de IA");
        }

        const instanceName = data?.instance_name || `bot-${session.user.id.substring(0, 5)}`;

        if (data) {
          setPerfil(data as PerfilBot);
          setNuevoPrompt(data.prompt_sistema || "");
        }

        // 2) Verificar si la instancia ya está conectada en Evolution API
        try {
          setStatus("Verificando sesión...");
          const res = await fetch(`${API_URL}/instance/connect/${instanceName}`);
          const connectData = (await res.json()) as { base64?: string; instance?: { state: string } };

          if (connectData.instance?.state === "open") {
            // Ya está conectado, cargar chats directamente
            setStatus("Conectado ✅");
            setQr(null);
            cargarChats(instanceName);

            // Asegurar que el webhook esté configurado correctamente con la URL del backend
            void fetch(`${API_URL}/instance/setup-webhook/${instanceName}`, { method: 'POST' });

            // Si no hay perfil en el backend, crearlo ahora
            if (!data) {
              const newPerfil = {
                id: session.user.id,
                email: session.user.email || "",
                instance_name: instanceName,
                prompt_sistema: "",
              };
              const resSave = await fetch(`${API_URL.replace('/chat/findChat', '')}/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPerfil)
              });
              const savedData = (await resSave.json()) as PerfilBot;
              setPerfil(savedData);
            }
          } else if (connectData.base64) {
            // Hay QR pendiente de escaneo
            setQr(connectData.base64);
            setStatus("Listo para escanear");
          } else {
            // La instancia existe pero no está conectada, mostrar botón Vincular
            setStatus("Desconectado");
          }
        } catch (err: unknown) {
          console.error("Error connecting to instance/fetch:", err);
          setStatus("Desconectado");
        }
      } catch (err: unknown) {
        console.error("Init Error:", err);
        setStatus("Desconectado");
      }

      setLoading(false);
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, API_URL, cargarChats]);

  // Polling para detectar cuando se escanea el QR
  useEffect(() => {
    let pollingInterval: ReturnType<typeof setInterval>;
    if (qr && status !== "Conectado ✅" && perfil?.instance_name) {
      pollingInterval = setInterval(() => {
        void fetchQR(perfil.instance_name);
      }, 60000);
    }
    return () => clearInterval(pollingInterval);
  }, [qr, status, perfil, fetchQR]);

  // Auto-refresh de chats cuando está conectado
  useEffect(() => {
    let chatInterval: ReturnType<typeof setInterval>;
    if (status === "Conectado ✅" && perfil?.instance_name) {
      chatInterval = setInterval(() => {
        void cargarChats();
      }, 15000);
    }
    return () => clearInterval(chatInterval);
  }, [status, perfil, cargarChats]);

  // Auto-refresh de mensajes del chat seleccionado (DESACTIVADO EN FAVOR DE SOCKET.IO)
  /*
  useEffect(() => {
    let msgInterval: ReturnType<typeof setInterval>;
    if (chatSeleccionado && status === "Conectado ✅") {
      msgInterval = setInterval(() => {
        void fetchMessages(chatSeleccionado);
      }, 5000);
    }
    return () => clearInterval(msgInterval);
  }, [chatSeleccionado, status, fetchMessages]);
  */

  // Ref para el socket y para el chat seleccionado
  const socketRef = useRef<Socket | null>(null);
  const chatRef = useRef(chatSeleccionado);

  useEffect(() => {
    chatRef.current = chatSeleccionado;
  }, [chatSeleccionado]);

  // Integración de Socket.io para tiempo real
  useEffect(() => {
    if (!session || socketRef.current) return;

    const socket = io(API_URL.replace('/api/whatsapp', ''), {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('[Socket] Conectado al backend');
    });

    socket.on('presence_update', (payload: PresencePayload) => {
      const remoteJid = payload.data.id;
      const presence = payload.data.presences[Object.keys(payload.data.presences)[0]]?.lastKnownPresence;

      if (presence === 'composing') {
        setTypingChatId(remoteJid);
      } else {
        setTypingChatId(null);
      }
    });

    socket.on('chats_update', () => {
      void cargarChats();
    });

    socket.on('chat_delete', (payload: ChatDeletePayload) => {
      console.log('[Socket] Chat(s) eliminado(s):', payload);
      const deletedIds = payload.data;
      setChats(prev => prev.filter(c => !deletedIds.includes(c.id)));

      const currentChat = chatRef.current;
      if (currentChat && deletedIds.includes(currentChat.id)) {
        setChatSeleccionado(null);
        setMensajes([]);
      }
    });

    socket.on('messages_set', () => {
      const currentChat = chatRef.current;
      if (currentChat) {
        void fetchMessages(currentChat);
      }
    });

    socket.on('new_message', (payload: NewMessagePayload) => {
      console.log('[Socket] Mensaje recibido:', payload);

      // Siempre refrescar la lista de chats para mover al tope y actualizar preview
      void cargarChats();

      const currentChat = chatRef.current;

      if (
        currentChat &&
        payload.message.remoteJid === currentChat.id &&
        (perfil?.instance_name === payload.instance || payload.instance.startsWith('bot-'))
      ) {
        setMensajes(prev => {
          if (prev.some(m => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        scrollToBottom();
      }

      // Actualizamos manualmente el previo del chat en la lista para que sea instantáneo
      setChats(prev => prev.map(c => {
        if (c.id === payload.message.remoteJid) {
          return {
            ...c,
            lastMessage: {
              ...c.lastMessage,
              message: { conversation: payload.message.text }
            }
          };
        }
        return c;
      }));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, perfil?.instance_name, API_URL, cargarChats, fetchMessages]);

  // Lógica del Tutorial Guiado (Onboarding)
  useEffect(() => {
    if (!profileLoading && !hasSeenTutorial && status !== "Verificando sesión..." && !tutorialStarted.current) {
      tutorialStarted.current = true;
      const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        nextBtnText: "Siguiente",
        prevBtnText: "Anterior",
        doneBtnText: "Finalizar",
        steps: [
          {
            element: "#tour-welcome",
            popover: {
              title: "¡Bienvenido a Bot-AI! 🚀",
              description: "Te ayudaremos a configurar tu asistente de WhatsApp en unos pocos pasos.",
              side: "bottom",
              align: "center"
            }
          },
          {
            element: "#tour-status",
            popover: {
              title: "Estado de Conexión",
              description: "Aquí puedes ver si tu WhatsApp está conectado o si necesitas vincularlo.",
              side: "bottom",
              align: "center"
            }
          },
          {
            element: "#tour-qr-section",
            popover: {
              title: "Vincular WhatsApp",
              description: "Para comenzar, haz clic en 'Vincular' y escanea el código QR desde tu teléfono (Ajustes > Dispositivos vinculados).",
              side: "left",
              align: "start"
            }
          },
          {
            element: "#tour-prompt",
            popover: {
              title: "Personalidad de la IA",
              description: "Aquí puedes definir cómo quieres que responda tu bot (formal, divertido, vendedor, etc).",
              side: "bottom",
              align: "center"
            }
          },
          {
            element: "#tour-cerebro",
            popover: {
              title: "El Cerebro del Bot",
              description: "¡Esta es la parte más importante! Aquí añades la información de tu negocio para que la IA sepa qué responder.",
              side: "bottom",
              align: "center"
            }
          },
          {
            popover: {
              title: "¡Todo listo!",
              description: "Ya puedes empezar a automatizar tus ventas por WhatsApp. ¡Suerte!",
              side: "bottom",
              align: "center"
            }
          },
        ],
        onDestroyed: async () => {
          // Marcar tutorial como completado globalmente
          void completeTutorial();
        }
      });

      driverObj.drive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, hasSeenTutorial]);


  return (
    <Layout>
      <div className="h-full bg-[#0b141a] text-[#e9edef] flex flex-col overflow-hidden">
        <header className="hidden lg:flex flex-shrink-0 p-4 bg-[#202c33] flex justify-between items-center border-b border-[#2a3942]">
          <div className="flex items-center gap-3">
            <div id="tour-welcome" className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center font-bold text-[#111b21]">
              {session?.user.email?.charAt(0).toUpperCase()}
            </div>
            <h1 className="font-bold flex items-center gap-2">
              <QrCode
                size={18}
                className={
                  qr ? "animate-pulse text-yellow-500" : "text-[#00a884]"
                }
              />
              <span id="tour-status">WhatsApp AI - {status}</span>
            </h1>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-[#aebac1] hover:text-white"
          >
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 flex flex-row min-h-0 overflow-hidden relative">
          <section className={`w-full lg:w-[300px] flex-shrink-0 border-r border-[#2a3942] flex flex-col bg-[#111b21] min-h-0 ${showMobileChat ? "hidden lg:flex" : "flex"
            }`}>
            <div className="p-4 flex flex-col gap-3 bg-[#202c33] border-b border-[#2a3942]">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-[#8696a0]">
                    Chats
                  </span>
                  {loading && <RefreshCw className="animate-spin text-[#00a884]" size={14} />}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    id="tour-prompt"
                    onClick={() => setShowPromptModal(true)}
                    className="text-[#34b7f1] hover:text-[#2fa3d8] transition-colors"
                    title="IA Prompt (Personalidad)"
                  >
                    <Bot size={18} />
                  </button>
                  <button
                    id="tour-cerebro"
                    onClick={() => setShowCerebroModal(true)}
                    className="text-[#00a884] hover:text-[#058f72] transition-colors"
                    title="Cerebro (Base de datos de IA)"
                  >
                    <BookOpen size={18} />
                  </button>
                  <button
                    onClick={() => {
                      void cargarChats();
                    }}
                    className="text-[#8696a0] hover:text-white transition-colors"
                    title="Actualizar chats"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Status móvil únicamente */}
              <div className="lg:hidden flex items-center justify-between bg-[#111b21] px-3 py-2 rounded-lg border border-[#2a3942]">
                <div className="flex items-center gap-2 overflow-hidden">
                  <QrCode
                    size={14}
                    className={qr ? "animate-pulse text-yellow-500" : "text-[#00a884]"}
                  />
                  <span className="text-[10px] font-bold text-[#e9edef] truncate uppercase tracking-widest">
                    {status}
                  </span>
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-[#ea4335] p-1"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => {
                    setChatSeleccionado(chat);
                    setShowMobileChat(true);
                    void fetchMessages(chat);
                  }}
                  className={`p-4 border-b border-[#2a3942] cursor-pointer hover:bg-[#202c33] ${chatSeleccionado?.id === chat.id ? "bg-[#2a3942]" : ""}`}
                >
                  <p className="text-sm font-bold truncate">
                    {chat.contact?.name || chat.id.split("@")[0]}
                  </p>
                  <p className="text-xs text-[#8696a0] truncate">
                    {chat.lastMessage?.message?.conversation ||
                      "Chat de WhatsApp"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={`flex-1 flex flex-col bg-[#0b141a] relative min-h-0 border-r border-[#2a3942] ${!showMobileChat ? "hidden lg:flex" : "flex"
            }`}>
            {chatSeleccionado ? (
              <>
                <div className="p-4 bg-[#202c33] border-b border-[#2a3942] flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowMobileChat(false)}
                      className="lg:hidden p-1 -ml-1 text-[#8696a0] hover:text-[#e9edef]"
                    >
                      <X size={20} />
                    </button>
                    <span className="font-bold text-sm">
                      {chatSeleccionado.contact?.name || chatSeleccionado.id.split("@")[0]}
                    </span>
                  </div>
                  {typingChatId === chatSeleccionado.id && (
                    <span className="text-xs text-[#00a884] animate-pulse font-medium">
                      escribiendo...
                    </span>
                  )}
                </div>
                <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-2 bg-[#0b141a] custom-scrollbar">
                  {cargandoMensajes ? (
                    <div className="flex-1 flex items-center justify-center text-[#8696a0]">
                      <RefreshCw className="animate-spin" size={20} />
                    </div>
                  ) : mensajes.length > 0 ? (
                    <>
                      {mensajes.map((msg) => (
                        <div
                          key={msg.id}
                          className={`max-w-[70%] p-3 rounded-lg text-sm shadow-sm transition-all ${msg.fromMe
                              ? "self-end bg-[#005c4b] rounded-br-none border-l-2 border-[#00a884] text-white"
                              : "self-start bg-[#202c33] rounded-bl-none border-r-2 border-[#8696a0] text-white"
                            }`}
                        >
                          <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                          <p className="text-[10px] text-[#8696a0] text-right mt-1 opacity-70">
                            {msg.timestamp}
                          </p>
                        </div>
                      ))}
                      <div ref={messagesEndRef} className="h-4 w-full flex-shrink-0" />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[#8696a0] text-sm italic">
                      No hay mensajes
                    </div>
                  )}
                </div>
                <div className="p-4 bg-[#202c33] flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-[#2a3942] p-2 rounded-lg outline-none text-sm placeholder:text-[#8696a0]"
                    placeholder="Escribe un mensaje..."
                    value={inputMensaje}
                    onChange={(e) => setInputMensaje(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleEnviar();
                    }}
                    disabled={enviando}
                  />
                  <button
                    onClick={() => { void handleEnviar(); }}
                    disabled={enviando || !inputMensaje.trim()}
                    className="text-[#00a884] p-2 hover:bg-[#2a3942] rounded-full disabled:opacity-30 transition-all"
                  >
                    <Send size={20} className={enviando ? "animate-pulse" : ""} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#8696a0]">
                {qr ? (
                  <div className="bg-white p-4 rounded-xl mb-4">
                    <img src={qr} className="w-48 h-48" alt="Scan me" />
                  </div>
                ) : (
                  <MessageSquare size={48} className="mb-2 opacity-20" />
                )}
                <p className="text-sm italic">
                  {qr ? "Escanea el código" : "Selecciona un chat"}
                </p>
                {!qr && !status.includes("✅") && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-[#8696a0] text-sm mb-6 max-w-md text-center">
                      Para comenzar a usar la IA, necesitas vincular tu cuenta de WhatsApp.
                    </p>
                    <button
                      id="tour-qr-section"
                      onClick={manejarConexionTotal}
                      className="bg-[#00a884] text-[#111b21] px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-[#06cf9c] transition-colors shadow-lg"
                    >
                      <QrCode size={20} />
                      Vincular WhatsApp
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {showPromptModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#202c33] p-6 rounded-xl border border-[#2a3942] w-full max-w-4xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowPromptModal(false)}
              className="absolute top-4 right-4 text-[#8696a0] hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-sm font-bold text-[#34b7f1] uppercase mb-4 flex items-center gap-2">
              <Bot size={18} /> IA Prompt (Personalidad)
            </h3>
            <textarea
              className="w-full h-96 bg-[#0b141a] text-[#e9edef] text-sm p-4 rounded-lg border border-[#2a3942] outline-none focus:border-[#34b7f1] resize-y leading-relaxed"
              placeholder="Ej: Eres un vendedor amable..."
              value={nuevoPrompt}
              maxLength={700}
              onChange={(e) => setNuevoPrompt(e.target.value)}
            />
            <div className="flex justify-end mt-1 px-1">
              <span className={`text-[10px] ${nuevoPrompt.length >= 640 ? 'text-yellow-500' : 'text-[#8696a0]'}`}>
                {650 - nuevoPrompt.length} caracteres restantes
              </span>
            </div>
            <button
              onClick={() => {
                void guardarConfiguracion();
                setShowPromptModal(false);
              }}
              className="w-full mt-4 bg-[#34b7f1] text-[#111b21] py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#2fa3d8] transition-colors"
            >
              <Save size={14} /> GUARDAR PERSONALIDAD
            </button>
          </div>
        </div>
      )}

      {showCerebroModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#202c33] p-6 rounded-xl border border-[#2a3942] w-full max-w-2xl flex flex-col max-h-[90vh] relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowCerebroModal(false)}
              className="absolute top-4 right-4 text-[#8696a0] hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex justify-between items-center mb-6 mr-8">
              <h3 className="text-sm font-bold text-[#00a884] uppercase flex items-center gap-2">
                <BookOpen size={18} /> Cerebro (Base de datos de IA)
              </h3>
              <div className="flex gap-2">

                <button onClick={() => void cargarMemoria()} className="text-[#8696a0] hover:text-[#00a884] p-2 bg-[#2a3942] rounded-lg transition-colors">
                  <RefreshCw size={16} className={cargandoMemoria ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Añadir nuevo dato (ej: Envío gratis a Caracas)"
                  className="flex-1 bg-[#0b141a] text-[#e9edef] text-sm p-3 rounded-lg border border-[#2a3942] outline-none focus:border-[#00a884]"
                  value={nuevoConocimiento}
                  maxLength={180}
                  onChange={(e) => setNuevoConocimiento(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void agregarMemoria()}
                />
                <button
                  onClick={() => void agregarMemoria()}
                  disabled={guardandoMemoria || !nuevoConocimiento.trim()}
                  className="bg-[#00a884] text-[#111b21] px-4 rounded-lg disabled:opacity-30 font-bold transition-opacity"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="flex justify-end mt-1 px-1">
                <span className={`text-[10px] ${nuevoConocimiento.length >= 170 ? 'text-yellow-500' : 'text-[#8696a0]'}`}>
                  {180 - nuevoConocimiento.length} caracteres restantes
                </span>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex flex-col gap-2 flex-1 pr-2">
              {memoria.length === 0 ? (
                <p className="text-sm text-[#8696a0] italic text-center py-12">No hay datos en el cerebro aún.</p>
              ) : (
                memoria.map((item) => (
                  <div key={item.id} className="bg-[#0b141a] p-4 rounded-lg border border-[#2a3942] group relative">
                    <p className="text-sm text-[#e9edef] pr-8 leading-normal">{item.contenido}</p>
                    <button
                      onClick={() => void borrarMemoria(item.id)}
                      className="absolute top-4 right-4 text-[#ea4335] opacity-0 group-hover:opacity-100 transition-opacity bg-[#2a3942] p-1.5 rounded-md hover:bg-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </Layout>

  );
};

export default Dashboard;
