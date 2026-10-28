// Sesión, datos de perfil y tema activos.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db, type AuthUser } from "@/services/data";
import { loadUserBundle } from "@/services/profile";
import type { UserBundle } from "@/lib/userBundle";
import type { ThemeName } from "@/types/domain";

// ---------- Autenticación ----------
interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  passwordRecovery: boolean;
}
const AuthCtx = createContext<AuthState>({ user: null, ready: false, passwordRecovery: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false, passwordRecovery: false });
  useEffect(() => {
    let active = true;
    db.auth.getUser().then((user) => active && setState((s) => ({ ...s, user, ready: true })));
    const off = db.auth.onChange((user, event) => {
      setState((s) => ({ user, ready: true, passwordRecovery: event === "PASSWORD_RECOVERY" ? true : s.passwordRecovery }));
    });
    return () => {
      active = false;
      off();
    };
  }, []);
  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

// ---------- Tema ----------
const THEME_KEY = "mgs:theme";

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "bro" ? "#101114" : theme === "sis" ? "#FFF8F6" : "#F6F7F6");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // preferencia no persistente
  }
}

export function storedTheme(): ThemeName {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "sis" || t === "bro" || t === "neutral") return t;
  } catch {
    // sin almacenamiento
  }
  return "neutral";
}

// ---------- Datos del usuario ----------
interface UserDataState {
  bundle: UserBundle | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
const UserDataCtx = createContext<UserDataState>({ bundle: null, loading: true, error: null, refresh: async () => undefined });

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [bundle, setBundle] = useState<UserBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setBundle(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const b = await loadUserBundle();
      setBundle(b);
      applyTheme(b.profile.theme);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu perfil.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ bundle, loading, error, refresh }), [bundle, loading, error, refresh]);
  return <UserDataCtx.Provider value={value}>{children}</UserDataCtx.Provider>;
}

export const useUserData = () => useContext(UserDataCtx);

/** Para pantallas protegidas: el bundle ya está cargado. */
export function useBundle(): UserBundle {
  const { bundle } = useUserData();
  if (!bundle) throw new Error("Perfil no cargado");
  return bundle;
}
