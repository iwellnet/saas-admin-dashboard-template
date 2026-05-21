import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { adminSupabase } from "./supabase";

type SuperAdminRole = "owner" | "support" | "viewer";

type SuperAdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: SuperAdminRole;
  is_active: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: SuperAdminProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SuperAdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string): Promise<SuperAdminProfile | null> {
    const { data, error } = await adminSupabase
      .from("super_admins")
      .select("id, email, full_name, role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[auth] loadProfile error:", error);
      return null;
    }
    if (!data || !data.is_active) return null;
    return data as SuperAdminProfile;
  }

  useEffect(() => {
    let mounted = true;

    // Страховочный таймаут: если Supabase не отвечает за 8 сек — снимаем loader
    const initTimer = setTimeout(() => {
      if (mounted) {
        console.warn("[auth] init timeout — forcing loading=false");
        setLoading(false);
      }
    }, 8000);

    adminSupabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      clearTimeout(initTimer);
      setSession(s);
      if (s?.user) {
        const p = await loadProfile(s.user.id);
        if (!mounted) return;
        setProfile(p);
        if (!p) await adminSupabase.auth.signOut();
      }
      setLoading(false);
    }).catch((err) => {
      console.error("[auth] getSession error:", err);
      clearTimeout(initTimer);
      if (mounted) setLoading(false);
    });

    const { data: listener } = adminSupabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        const p = await loadProfile(s.user.id);
        if (!mounted) return;
        setProfile(p);
        // Разлогиниваем только при явной смене сессии, НЕ при SIGNED_IN
        if (!p && event !== "SIGNED_IN") await adminSupabase.auth.signOut();
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(initTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await adminSupabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const p = await loadProfile(data.user.id);
    if (!p) {
      await adminSupabase.auth.signOut();
      return { error: "Access denied: not a super-admin" };
    }
    return { error: null };
  }

  async function signOut() {
    await adminSupabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
