import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useDispatch, useStore } from "react-redux";
import { AppDispatch, RootState } from "./store/store";
import { SESSION_EXPIRED } from "./lib/api";
import { bootSession, logout } from "./store/authSlice";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Catalog from "./pages/Catalog";
import CourseDetails from "./pages/CourseDetails";
import Dashboard from "./pages/Dashboard";
import CourseForm from "./pages/CourseForm";
import NotFound from "./pages/NotFound";

export default function App() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const nav = useNavigate();
  useEffect(() => { dispatch(bootSession()); }, [dispatch]);

  // Only signed-in users get bounced — a stale token at boot just means anonymous.
  useEffect(() => {
    const onExpired = () => {
      if (!store.getState().auth.user) return;
      dispatch(logout());
      nav("/login", { replace: true, state: { expired: true } });
    };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired);
  }, [dispatch, store, nav]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/courses" element={<Catalog />} />
          <Route path="/courses/:id" element={<CourseDetails />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/instructor/courses/new" element={<ProtectedRoute role="instructor"><CourseForm /></ProtectedRoute>} />
          <Route path="/instructor/courses/:id/edit" element={<ProtectedRoute role="instructor"><CourseForm /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}
