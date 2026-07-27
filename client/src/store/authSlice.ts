import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { api, ApiUser, setToken, getToken } from "../lib/api";

export interface AuthState {
  user: ApiUser | null;
  status: "idle" | "loading" | "error";
  error: string | null;
  booted: boolean;
}
const initialState: AuthState = { user: null, status: "idle", error: null, booted: false };

export const bootSession = createAsyncThunk("auth/boot", async () => {
  if (!getToken()) return null;
  try { const { user } = await api.me(); return user; }
  catch { setToken(null); return null; }
});

/** Re-pulls the session after something changes it server-side (e.g. enrolling). */
export const refreshUser = createAsyncThunk("auth/refresh", async () => {
  const { user } = await api.me();
  return user;
});

export const login = createAsyncThunk("auth/login", async (body: { email: string; password: string }) => {
  const { token, user } = await api.login(body);
  setToken(token);
  return user;
});

export const signup = createAsyncThunk(
  "auth/signup",
  async (body: { name: string; email: string; password: string; role: string }) => {
    const { token, user } = await api.signup(body);
    setToken(token);
    return user;
  }
);

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) { setToken(null); state.user = null; },
    // Login and Signup share one error field — each clears it on mount so a
    // failure on one form doesn't surface on the other.
    clearAuthError(state) { state.error = null; state.status = "idle"; },
  },
  extraReducers(b) {
    b.addCase(bootSession.fulfilled, (s, a) => { s.user = a.payload; s.booted = true; });
    b.addCase(bootSession.rejected, (s) => { s.booted = true; });
    b.addCase(refreshUser.fulfilled, (s, a: PayloadAction<ApiUser>) => { s.user = a.payload; });
    for (const t of [login, signup]) {
      b.addCase(t.pending, (s) => { s.status = "loading"; s.error = null; });
      b.addCase(t.fulfilled, (s, a: PayloadAction<ApiUser>) => { s.status = "idle"; s.user = a.payload; });
      b.addCase(t.rejected, (s, a) => { s.status = "error"; s.error = a.error.message ?? "Something went wrong"; });
    }
  },
});

export const { logout, clearAuthError } = slice.actions;
export default slice.reducer;
