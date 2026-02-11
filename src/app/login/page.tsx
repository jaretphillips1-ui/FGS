"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function errText(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err || fallback;

  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }

  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}

type AuthMethod = "magic" | "password";
type Mode = "signin" | "signup";

const LS_LAST_EMAIL = "fgs:lastEmail";
const LS_REMEMBER_EMAIL = "fgs:rememberEmail";

function safeGetLS(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key: string, val: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function safeRemoveLS(key: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function parseBoolLS(v: string | null, fallback: boolean) {
  if (v === null) return fallback;
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();

  const [method, setMethod] = useState<AuthMethod>("magic");
  const [mode, setMode] = useState<Mode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Remember email for convenience (email only; never password)
  const [rememberEmail, setRememberEmail] = useState(true);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth/callback`;
  }, []);

  // 1) If already signed in, bounce to /rods
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/rods");
    });
  }, [router]);

  // 2) Load rememberEmail + last email on first render (client only)
  useEffect(() => {
    const remember = parseBoolLS(safeGetLS(LS_REMEMBER_EMAIL), true);
    setRememberEmail(remember);

    if (remember) {
      const last = safeGetLS(LS_LAST_EMAIL);
      if (last && last.trim()) setEmail(last.trim());
    }
  }, []);

  // 3) Persist rememberEmail preference + email (when enabled)
  useEffect(() => {
    safeSetLS(LS_REMEMBER_EMAIL, rememberEmail ? "1" : "0");

    if (!rememberEmail) {
      safeRemoveLS(LS_LAST_EMAIL);
      return;
    }

    const eClean = email.trim();
    if (eClean) safeSetLS(LS_LAST_EMAIL, eClean);
  }, [rememberEmail, email]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const eClean = email.trim();
      if (!eClean) {
        setMsg("Enter your email.");
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: eClean,
        options: {
          emailRedirectTo: redirectTo,
          // create user automatically if they don't exist yet
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setMsg("Magic link sent — check your email and tap the link to sign in.");
    } catch (err: unknown) {
      setMsg(errText(err, "Could not send magic link."));
    } finally {
      setLoading(false);
    }
  }

  async function passwordAuth(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const eClean = email.trim();
      if (!eClean || !password) {
        setMsg("Enter email + password.");
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: eClean, password });
        if (error) throw error;
        router.replace("/rods");
      } else {
        const { error } = await supabase.auth.signUp({ email: eClean, password });
        if (error) throw error;

        const { data } = await supabase.auth.getSession();
        if (data.session) router.replace("/rods");
        else setMsg("Account created. Check your email if confirmations are enabled, then sign in.");
      }
    } catch (err: unknown) {
      setMsg(errText(err, "Login failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>FGS Login</h1>
      <p style={{ marginTop: 6, color: "#555" }}>
        Recommended: <b>Magic Link</b> (best on iPhone). Password login is optional.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setMethod("magic")}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: method === "magic" ? "#eee" : "white",
          }}
        >
          Magic Link
        </button>
        <button
          onClick={() => setMethod("password")}
          disabled={loading}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: method === "password" ? "#eee" : "white",
          }}
        >
          Password
        </button>

        {method === "password" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setMode("signin")}
              disabled={loading}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: mode === "signin" ? "#eee" : "white",
              }}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              disabled={loading}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: mode === "signup" ? "#eee" : "white",
              }}
            >
              Create account
            </button>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={method === "magic" ? sendMagicLink : passwordAuth}
        style={{ marginTop: 16, display: "grid", gap: 12 }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={rememberEmail}
            onChange={(e) => { const v = e.target.checked; setRememberEmail(v); if (!v) setEmail(""); }}
            disabled={loading}
          />
          <span>Remember my email on this device</span>
        </label>

        {method === "password" ? (
          <label style={{ display: "grid", gap: 6 }}>
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#f5f5f5",
            cursor: "pointer",
          }}
        >
          {loading
            ? "Working..."
            : method === "magic"
              ? "Send Magic Link"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
        </button>

        {msg ? <p style={{ margin: 0 }}>{msg}</p> : null}

        <p style={{ margin: 0, color: "#666", fontSize: 12 }}>
          Security note: we only store your <b>email</b> locally (optional). We do <b>not</b> store passwords. Supabase handles session
          persistence (“keep me signed in”) safely.
        </p>

        {method === "magic" ? (
          <p style={{ margin: 0, color: "#666", fontSize: 12 }}>
            Tip: on iPhone, open your email and tap the link — it’ll bounce through <code>/auth/callback</code> and land you in the app.
          </p>
        ) : null}
      </form>
    </main>
  );
}

