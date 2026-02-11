"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function getHashParams() {
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(raw);
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState<string>("Finalizing sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const url = new URL(window.location.href);
        const next = url.searchParams.get("next") ?? "/rods";

        // 1) Preferred: implicit magic link tokens in the hash
        const hash = getHashParams();
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          setMsg("Setting session…");

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          // Remove tokens from URL
          window.history.replaceState({}, "", `${url.origin}${url.pathname}${url.search}`);
          window.location.replace(next);
          return;
        }

        // 2) If we ever see a PKCE-style code, do NOT try to exchange it here.
        // It will fail when the verifier is missing (different browser/device/profile).
        const code = url.searchParams.get("code");
        if (code) {
          setMsg(
            "This link is using a PKCE code (code=...). That can fail if opened outside the original browser session. " +
              "Go back to /login and request a fresh magic link (implicit)."
          );
          return;
        }

        // 3) Supabase may also detect a session automatically via detectSessionInUrl,
        // so if we have one, just bounce through.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          window.location.replace(next);
          return;
        }

        setMsg("No auth tokens found. Please go back to /login and request a fresh magic link.");
      } catch (e: unknown) {
        const text = getErrorMessage(e);
        if (!cancelled) setMsg(`Sign-in failed: ${text}`);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>FGS</h1>
      <p>{msg}</p>
      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        If this gets stuck, go back to <a href="/login">/login</a> and request a fresh magic link.
      </p>
    </main>
  );
}
