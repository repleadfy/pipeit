import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { LoadingScreen } from "./LoadingScreen.js";

export function ProtectedRoute({
  children,
  fallback = <Navigate to="/login" replace />,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <>{fallback}</>;
  return <>{children}</>;
}
