import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import { type PlanId } from "../config/planConfig";

export interface AuthContextType {
  session: Session | null;
  signOut: () => Promise<void>;
  isVerified: boolean;
  hasEmpresa: boolean;
  plan: PlanId;
  role: string;
  isOwner: boolean;
  isTrial: boolean;
  isPlanExpired: boolean;
  vencimientoPlan: string | null;
  limits: { agentes: number };
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

export interface ProfileResponse {
  profile?: {
    is_email_verified: boolean;
    empresa_id: string;
    role: string;
    is_owner: boolean;
  };
  empresa?: {
    plan: string;
    is_trial: boolean;
    vencimiento_plan: string | null;
    limite_agentes: number;
  };
  isPlanExpired?: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  signOut: async () => {},
  isVerified: false,
  hasEmpresa: false,
  plan: "gratis",
  role: "agente",
  isOwner: false,
  isTrial: false,
  isPlanExpired: false,
  vencimientoPlan: null,
  limits: { agentes: 1 },
  profileLoading: true,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);
