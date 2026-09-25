"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { sbRpc } from "./supabase";

/**
 * Tourist accounts stored in Supabase (public.app_users). Passwords are bcrypt-hashed
 * inside the database by the app_signup / app_signin functions; the app only keeps a
 * random 30-day session token on the device.
 */
export interface AppUser {
  name: string;
  email: string;
}

interface Session extends AppUser {
  token: string;
}

type AuthError = "invalid" | "taken" | "short" | "email" | "name" | "network";

interface AuthState {
  ready: boolean;
  user: AppUser | null;
  signUp: (name: string, email: string, password: string) => Promise<AuthError | null>;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
}

const KEY = "payana_session_v1";
const Ctx = createContext<AuthState | null>(null);

function mapError(e: unknown): AuthError {
  const msg = String(e);
  if (msg.includes("invalid_credentials")) return "invalid";
  if (msg.includes("email_taken")) return "taken";
  if (msg.includes("password_too_short")) return "short";
  if (msg.includes("invalid_email")) return "email";
  if (msg.includes("name_required")) return "name";
  return "network";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the saved session, then confirm it with the database (stay signed in offline).
  useEffect(() => {
    let saved: Session | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {}
    setSession(saved);
    setReady(true);
    if (!saved) return;
    sbRpc<AppUser | null>("app_session", { p_token: saved.token })
      .then((u) => {
        if (u) {
          const next = { ...saved!, ...u };
          setSession(next);
          localStorage.setItem(KEY, JSON.stringify(next));
        } else {
          localStorage.removeItem(KEY); // expired or signed out elsewhere
          setSession(null);
        }
      })
      .catch(() => {});
  }, []);

  const keep = (s: Session) => {
    setSession(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  };

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      keep(await sbRpc<Session>("app_signup", { p_name: name, p_email: email, p_password: password }));
      return null;
    } catch (e) {
      return mapError(e);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      keep(await sbRpc<Session>("app_signin", { p_email: email, p_password: password }));
      return null;
    } catch (e) {
      return mapError(e);
    }
  }, []);

  const signOut = useCallback(async () => {
    const token = session?.token;
    setSession(null);
    try {
      localStorage.removeItem(KEY);
    } catch {}
    if (token) await sbRpc("app_signout", { p_token: token }).catch(() => {});
  }, [session]);

  const user = session ? { name: session.name, email: session.email } : null;
  return <Ctx.Provider value={{ ready, user, signUp, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
