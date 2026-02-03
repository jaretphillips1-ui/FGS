// NOTE:
// This project runtime treats Next.js dynamic APIs (cookies/headers/params) as async Promises,
// and the cookie store does not expose .get/.getAll consistently under Turbopack in this setup.
// Supabase SSR in server components is therefore disabled for now.
// We keep this placeholder so future middleware/route-handler SSR can be added cleanly.

export function supabaseServer(): never {
  throw new Error("supabaseServer() is disabled in this runtime. Use client supabase.");
}
