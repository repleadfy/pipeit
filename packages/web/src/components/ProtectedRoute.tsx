import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

export function ProtectedRoute({
  children,
  fallback = <Navigate to="/login" replace />,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <>{fallback}</>;
  return <>{children}</>;
}
