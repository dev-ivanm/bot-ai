import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  mandatoryOnboarding?: boolean;
}

const ProtectedRoute = ({ children, mandatoryOnboarding = true }: ProtectedRouteProps) => {
  const { session, isVerified, hasEmpresa, isPlanExpired, isOwner, profileLoading } = useAuth();

  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#00a884]" size={32} />
      </div>
    );
  }

  // 1. Gate: Email verification
  if (!isVerified && location.pathname !== "/verify-email") {
    return <Navigate to="/verify-email" replace />;
  }

  // 2. Gate: Mandatory Onboarding (Profile)
  // Only redirect to /profile if we are NOT already on /profile and it's mandatory
  if (isVerified && !hasEmpresa && mandatoryOnboarding && location.pathname !== "/profile") {
    return <Navigate to="/profile" replace />;
  }

  // 3. Gate: Plan Expiration (Transición al Plan Gratis)
  // Si el plan expiró, solo el dueño (1 agente) puede seguir operando.
  if (isPlanExpired && !isOwner && location.pathname !== "/expired-plan") {
      return <Navigate to="/expired-plan" replace />;
  }


  return <>{children}</>;
};

export default ProtectedRoute;
