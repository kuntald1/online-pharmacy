import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-ink-soft text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
}
