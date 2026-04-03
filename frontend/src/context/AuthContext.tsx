import { useEffect, useState, useCallback } from "react";import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { type PlanId } from "../config/planConfig";
import { AuthContext } from "./auth-context";
import type { ProfileResponse } from "./auth-context";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [hasEmpresa, setHasEmpresa] = useState(false);
  const [plan, setPlan] = useState<PlanId>("gratis");
  const [role, setRole] = useState("agente");
  const [isOwner, setIsOwner] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [isPlanExpired, setIsPlanExpired] = useState(false);
  const [vencimientoPlan, setVencimientoPlan] = useState<string | null>(null);
  const [limits, setLimits] = useState({ agentes: 1 });
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/whatsapp/profile/me?userId=${session.user.id}`);
      if (res.ok) {
        const data = (await res.json()) as ProfileResponse;
        setIsVerified(!!data.profile?.is_email_verified);
        setHasEmpresa(!!data.profile?.empresa_id);
        setPlan((data.empresa?.plan || "gratis") as PlanId);
        setRole(data.profile?.role || "agente");
        setIsOwner(!!data.profile?.is_owner);
        setIsTrial(!!data.empresa?.is_trial);
        setIsPlanExpired(!!data.isPlanExpired);
        setVencimientoPlan(data.empresa?.vencimiento_plan || null);
        
        // Estrategia de Persistencia Doble (DB + LocalStorage)
        const localTutorialSeen = localStorage.getItem('bot_ai_tutorial_seen') === 'true';
        const serverTutorialSeen = !!data.profile?.has_seen_tutorial;
        
        setHasSeenTutorial(localTutorialSeen || serverTutorialSeen);
        
        setLimits({
          agentes: (data.isPlanExpired || data.empresa?.plan === 'gratis') ? 1 : (data.empresa?.limite_agentes || 1)
        });
      }
    } catch (err: unknown) {
      console.error("Error refreshing profile:", err);
    } finally {
      setProfileLoading(false);
    }
  }, [session, BACKEND_URL]);

  const completeTutorial = async () => {
    if (!session?.user.id) return;
    
    // Optimistic update: marcar como visto localmente de inmediato
    setHasSeenTutorial(true);
    localStorage.setItem('bot_ai_tutorial_seen', 'true');

    try {
      await fetch(`${BACKEND_URL}/api/whatsapp/profile/complete-tutorial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      // Sincronizar con el servidor
      void refreshProfile();
    } catch (err: unknown) {
      console.error("Error completando el tutorial:", err);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setInitialized(true);
      });

    // Escuchar cambios (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      refreshProfile();
    } else if (initialized) {
      setIsVerified(false);
      setHasEmpresa(false);
      setPlan("gratis");
      setRole("agente");
      setIsOwner(false);
      setIsTrial(false);
      setIsPlanExpired(false);
      setVencimientoPlan(null);
      setProfileLoading(false);
    }
  }, [session, initialized, refreshProfile]);

  return (
    <AuthContext.Provider value={{ 
      session, 
      signOut, 
      isVerified, 
      hasEmpresa, 
      plan,
      role,
      isOwner,
      isTrial,
      isPlanExpired,
      vencimientoPlan,
      limits,
      profileLoading, 
      hasSeenTutorial,
      refreshProfile,
      completeTutorial 
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 
