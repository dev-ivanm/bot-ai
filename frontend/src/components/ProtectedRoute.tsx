import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  mandatoryOnboarding?: boolean;
}

const ProtectedRoute = ({ children, mandatoryOnboarding = true }: ProtectedRouteProps) => {
  const { session, isVerified, hasEmpresa, isPlanExpired, profileLoading } = useAuth();
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

  // 3. Gate: Plan Expiration
  // Redirect to /expired-plan if the plan is expired, EXCEPT  // Si el plan ha expirado, permitir solo Chats, Perfil y Upgrade
  const allowedPathsWhenExpired = ["/dashboard", "/profile", "/upgrade"];
  const isPathAllowed = allowedPathsWhenExpired.some(path => location.pathname.startsWith(path));

  if (isPlanExpired && !isPathAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
