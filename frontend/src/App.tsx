import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/auth-context';
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Stats from "./pages/Stats";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Upgrade from "./pages/Upgrade";
import PlanManager from "./pages/PlanManager";
import VerifyEmail from "./pages/VerifyEmail";
import Profile from "./pages/Profile";
import ExpiredPlan from "./pages/ExpiredPlan";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster } from "react-hot-toast";


function App() {
  const { session } = useAuth();

  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: "#202c33",
            color: "#e9edef",
            border: "1px solid #2a3942",
          },
          success: {
            iconTheme: {
              primary: "#00a884",
              secondary: "#e9edef",
            },
          },
        }}
      />
      <Routes>

        {/* Public Routes */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!session ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Private Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
        <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
        <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
        <Route path="/admin/planes" element={<ProtectedRoute><PlanManager /></ProtectedRoute>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/profile" element={<ProtectedRoute mandatoryOnboarding={false}><Profile /></ProtectedRoute>} />
        <Route path="/expired-plan" element={<ExpiredPlan />} />
        
        {/* Default Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;