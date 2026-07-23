import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";

export default function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { user, booted } = useSelector((s: RootState) => s.auth);
  if (!booted) return <div className="p-10 text-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
