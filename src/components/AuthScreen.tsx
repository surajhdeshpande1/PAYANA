"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail, ShieldCheck, User, UserPlus } from "lucide-react";
import { useApp } from "@/lib/store";
import { HAS_ACCOUNT_KEY, useAuth } from "@/lib/auth";
import { LangSwitch } from "./ui";

/** Sign up / sign in — shown before the app until the tourist has an account session. */
export default function AuthScreen() {
  const { t, lang, setLang } = useApp();
  const { signIn, signUp } = useAuth();
  // New visitors start on "Create account"; someone who has signed in on this phone before starts on "Sign in".
  const [mode, setMode] = useState<"signin" | "signup">(() => {
    try {
      return localStorage.getItem(HAS_ACCOUNT_KEY) ? "signin" : "signup";
    } catch {
      return "signup";
    }
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (mode === "signup" && name.trim().length < 2) return setErr(t("auth.err.name"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr(t("auth.err.email"));
    if (password.length < 6) return setErr(t("auth.err.short"));
    setBusy(true);
    const res = mode === "signup" ? await signUp(name.trim(), email.trim(), password) : await signIn(email.trim(), password);
    setBusy(false);
    if (!res) setLang(lang); // keep the language shown here; no separate language screen afterwards
    if (res) {
      setErr(t(`auth.err.${res}`));
      if (res === "taken") setMode("signin");
    }
  }

  const swap = () => {
    setErr("");
    setMode(mode === "signup" ? "signin" : "signup");
  };

  return (
    <div className="fixed inset-0 z-[78] overflow-y-auto bg-maroon-950">
      <div className="relative h-56 overflow-hidden">
        <img src="/images/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-maroon-950/50 via-maroon-950/40 to-maroon-950" />
        <div className="absolute right-3 top-3">
          <LangSwitch compact />
        </div>
        <div className="absolute inset-x-0 bottom-4 px-6 text-center">
          <img src="/icons/icon-192.png" alt="" className="mx-auto mb-2 h-14 w-14 rounded-2xl shadow-xl" />
          <h1 className="gold-text font-display text-[44px] font-semibold leading-none tracking-[0.14em]">PAYANA</h1>
          <div className="hairline mx-auto mt-2 w-32" />
        </div>
      </div>

      <form onSubmit={submit} className="fade-up mx-auto w-full max-w-sm space-y-4 px-6 pb-10 pt-4">
        <div className="text-center">
          <h2 className="font-serif text-[26px] font-semibold text-white">{mode === "signup" ? t("auth.signup") : t("auth.welcome")}</h2>
          <p className="mt-1 text-sm text-sand">{mode === "signup" ? t("auth.subUp") : t("auth.subIn")}</p>
        </div>

        {/* Mode switch */}
        <div className="grid grid-cols-2 rounded-full border border-white/15 bg-white/[0.04] p-1">
          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setErr("");
                setMode(m);
              }}
              className={`rounded-full py-2 text-sm font-semibold transition ${mode === m ? "bg-white text-maroon-950" : "text-sand"}`}
            >
              {t(`auth.${m}`)}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <label className="block">
            <span className="label">{t("auth.name")}</span>
            <span className="relative block">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-10" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
            </span>
          </label>
        )}
        <label className="block">
          <span className="label">{t("auth.email")}</span>
          <span className="relative block">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-10"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              maxLength={120}
            />
          </span>
        </label>
        <label className="block">
          <span className="label">{t("auth.password")}</span>
          <span className="relative block">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input px-10"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              maxLength={72}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={t("auth.show")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          {mode === "signup" && <span className="mt-1 block text-[11px] text-muted">{t("auth.passwordHint")}</span>}
        </label>

        {err && <p className="rounded-xl border border-packed/40 bg-packed/10 px-3 py-2 text-sm text-packed">{err}</p>}

        <button type="submit" disabled={busy} className="btn-gold w-full py-3.5 text-base">
          {busy ? <Loader2 size={18} className="animate-spin" /> : mode === "signup" ? <UserPlus size={18} /> : <LogIn size={18} />}
          {mode === "signup" ? t("auth.signup") : t("auth.signin")}
        </button>

        <p className="text-center text-sm text-sand">
          {mode === "signup" ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
          <button type="button" onClick={swap} className="font-semibold text-gold underline-offset-2 hover:underline">
            {mode === "signup" ? t("auth.signin") : t("auth.signup")}
          </button>
        </p>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck size={13} className="text-teal" /> {t("auth.secure")}
        </p>
      </form>
    </div>
  );
}
