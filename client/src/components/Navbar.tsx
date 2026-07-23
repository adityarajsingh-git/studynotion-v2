import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { logout } from "../store/authSlice";

export default function Navbar() {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();

  return (
    <nav className="sticky top-0 z-20 border-b border-edge bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link to="/" className="text-lg font-bold text-cream">
          StudyNotion <span className="text-amber">v2</span>
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <NavLink to="/courses" className={({ isActive }) => isActive ? "text-amber" : "hover:text-cream"}>
            Catalog
          </NavLink>
          {user ? (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => isActive ? "text-amber" : "hover:text-cream"}>
                Dashboard
              </NavLink>
              <button
                onClick={() => { dispatch(logout()); nav("/"); }}
                className="rounded-lg border border-edge px-4 py-1.5 hover:border-amber hover:text-cream"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="hover:text-cream">Log in</NavLink>
              <NavLink to="/signup" className="rounded-lg bg-amber px-4 py-1.5 font-semibold text-ink hover:bg-amber-dark">
                Sign up
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
