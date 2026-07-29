import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";

export default function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactElement;
  /** When set, only this role may enter — anyone else signed in goes to /dashboard. */
  role?: "instructor" | "student";
}) {
  const { user, booted } = useSelector((s: RootState) => s.auth);
  if (!booted) return <div className="p-10 text-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Wrong role ≠ not logged in: send them to their dashboard, not the login page.
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}
