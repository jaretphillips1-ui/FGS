import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function mustGetEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.length > 0) return v;
  }
  throw new Error(`Missing Supabase env var. Tried: ${keys.join(", ")}`);
}

function asCookieOptions(options: unknown): Record<string, unknown> {
  if (options && typeof options === "object" && !Array.isArray(options)) return options as Record<string, unknown>;
  return {};
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/rods";

  const cookieStore = await cookies();

  const supabaseUrl = mustGetEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL");

  const supabaseAnonKey = mustGetEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY_PUBLISHABLE",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY"
  );

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: unknown) {
        cookieStore.set({ name, value, ...asCookieOptions(options) });
      },
      remove(name: string, options: unknown) {
        cookieStore.set({ name, value: "", ...asCookieOptions(options), maxAge: 0 });
      },
    },
  });

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
