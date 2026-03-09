import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useUserContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
