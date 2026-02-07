"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import RodsListClient from "./RodsListClient";
import { normalizeTechniques, sortTechniques } from "@/lib/rodTechniques";

type RodRow = {
  id: string;
  name: string;
  status?: string | null;
  created_at?: string | null;
  rod_techniques?: string[] | string | null;
};

type AuthState = "unknown" | "signed_out" | "signed_in";

function hardTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Soft timeout: returns { timedOut: true } instead of throwing.
// This prevents "timeout == signed out" false-positives.
async function getSessionSoft(ms: number): Promise<{
  timedOut: boolean;
  session: any | null;
  error?: string;
}> {
  try {
    const res = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: any | null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), ms)
      ),
    ]);

    // If the timeout path fired, res is our synthetic object.
    // We detect that by checking whether auth.getSession likely returned fast with data.session,
    // but if it didn't, treat it as timed out.
    // (This is intentionally conservative: "unknown" is safer than "signed out".)
    const session = (res as any)?.data?.session ?? null;
    const timedOut = session == null; // session-null could also be legit signed-out; we'll handle below carefully.
    return { timedOut, session };
  } catch (e: any) {
    return { timedOut: false, session: null, error: e?.message ?? "Auth session error." };
  }
}

export default function RodLockerPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [rows, setRows] = useState<RodRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // First paint loading (only for initial load)
  const [initialLoading, setInitialLoading] = useState(true);
  // Subsequent refresh indicator (keeps page visible)
  const [refreshing, setRefreshing] = useState(false);

  // Prevent overlapping loads from leaving us stuck.
  const loadSeq = useRef(0);

  async function load(opts?: { reason?: string }) {
    const seq = ++loadSeq.current;

    // Only blank-screen on first load.
    if (initialLoading) setInitialLoading(true);
    else setRefreshing(true);

    // Don’t clear user/rows immediately; keep UI stable while we refresh.
    setErr(null);

    try {
      // Soft auth check first. If it takes too long, don't claim signed out.
      const sessionRes = await getSessionSoft(6000);

      // If auth call errored, report but do not wipe state.
      if (sessionRes.error) {
        if (seq === loadSeq.current) {
          setAuthState("unknown");
          setErr(sessionRes.error);
        }
        return;
      }

      const session = sessionRes.session;
      const user = session?.user ?? null;

      // If we timed out AND we don't have a known user yet, treat as "unknown"
      // (shows retry, not "you need to sign in").
      if (sessionRes.timedOut && !user && !userEmail) {
        if (seq === loadSeq.current) {
          setAuthState("unknown");
          setErr("Auth check is taking longer than expected. Click Retry.");
        }
        return;
      }

      // If no user (and not in the "unknown" timeout case), treat as signed out.
      if (!user) {
        if (seq === loadSeq.current) {
          setAuthState("signed_out");
          setUserEmail(null);
          setRows([]);
        }
        return;
      }

      if (seq === loadSeq.current) {
        setAuthState("signed_in");
        setUserEmail(user.email ?? null);
      }

      // Load rods (hard timeout is fine here; it won't misrepresent auth status)
      const queryRes = await hardTimeout(
        supabase
          .from("gear_items")
          .select("id,name,status,created_at,rod_techniques")
          .eq("gear_type", "rod")
          .order("created_at", { ascending: false }),
        8000,
        "gear_items select"
      );

      if ((queryRes as any).error) {
        if (seq === loadSeq.current) setErr((queryRes as any).error.message);
        return;
      }

      if (seq === loadSeq.current) {
        setRows(((queryRes as any).data ?? []) as RodRow[]);
      }
    } catch (e: any) {
      if (seq === loadSeq.current) {
        // Don’t automatically wipe userEmail unless we truly know they’re signed out.
        setAuthState(userEmail ? "signed_in" : "unknown");
        setErr(e?.message ?? "Unknown error while loading rods.");
      }
    } finally {
      if (seq === loadSeq.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function addTestRod() {
    setErr(null);

    const sessionRes = await supabase.auth.getSession();
    const user = sessionRes.data.session?.user;
    if (!user) return setErr("Not signed in.");

    const suffix = new Date().toISOString().slice(11, 19);
    const rodName = "Test Rod " + suffix;

    const { error } = await supabase.from("gear_items").insert({
      owner_id: user.id,
      gear_type: "rod",
      status: "owned",
      name: rodName,
      saltwater_ok: false,
    });

    if (error) setErr(error.message);
    await load({ reason: "addTestRod" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    await load({ reason: "signOut" });
  }

  useEffect(() => {
    load({ reason: "mount" });
    const { data: sub } = supabase.auth.onAuthStateChange(() => load({ reason: "authChange" }));
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initialLoading) return <main className="p-6">Loading…</main>;

  // AUTH UNKNOWN (timeouts / slow auth): show a truthful state.
  if (authState === "unknown") {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Rod Locker</h1>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <p className="mt-2 text-gray-600">
          Checking your session… if this doesn’t clear, hit Retry.
        </p>

        <div className="mt-6 flex gap-3 flex-wrap">
          <button className="px-4 py-2 rounded border" onClick={() => load({ reason: "retryAuth" })}>
            Retry
          </button>
          <Link className="inline-block underline mt-2" href="/login">
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  // SIGNED OUT
  if (authState === "signed_out" || !userEmail) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Rod Locker</h1>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <p className="mt-2 text-gray-600">You need to sign in first.</p>
        <Link className="inline-block mt-4 underline" href="/login">
          Go to login
        </Link>

        <div className="mt-6">
          <button className="px-4 py-2 rounded border" onClick={() => load({ reason: "retrySignedOut" })}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  // SIGNED IN
  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rod Locker</h1>
          <p className="text-sm text-gray-600">
            Signed in as {userEmail}
            {refreshing ? <span className="ml-2 opacity-70">(refreshing…)</span> : null}
          </p>
        </div>
        <button className="px-3 py-2 rounded border" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button className="px-4 py-2 rounded bg-black text-white" onClick={addTestRod}>
          Add Test Rod
        </button>

        <button className="px-4 py-2 rounded border" onClick={() => router.push("/rods/new")}>
          New Rod
        </button>

        <button className="px-4 py-2 rounded border" onClick={() => load({ reason: "refreshBtn" })}>
          Refresh
        </button>
      </div>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

      <RodsListClient rows={rows}>
        {(filteredRows, setTechniqueFilter) => (
          <>
            <ul className="mt-6 space-y-2">
              {filteredRows.map((r) => (
                <li
                  key={r.id}
                  className="border rounded p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/rods/${r.id}`)}
                >
                  <div className="font-medium">{r.name}</div>

                  {(() => {
                    const techs = normalizeTechniques(r.rod_techniques as any);
                    if (techs.length === 0) return null;

                    // Primary is always the FIRST stored technique.
                    const primary = String(techs[0] ?? "").trim();

                    // Secondary techniques: unique + sorted, excluding primary.
                    const secondarySorted = sortTechniques(techs).filter((t) => t !== primary);

                    // Render order: [primary, ...secondary]
                    const display = primary ? [primary, ...secondarySorted] : secondarySorted;

                    if (display.length === 0) return null;

                    return (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {display.map((t) => {
                          const isPrimary = primary && t === primary;

                          const cls = isPrimary
                            ? "text-xs px-2 py-0.5 rounded bg-green-600 text-white border border-green-700 hover:bg-green-700"
                            : "text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border hover:bg-gray-200";

                          return (
                            <button
                              type="button"
                              key={t}
                              className={cls}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTechniqueFilter(t);
                              }}
                              title={
                                isPrimary
                                  ? "Primary technique (click to filter)"
                                  : "Secondary technique (click to filter)"
                              }
                              aria-label={
                                isPrimary
                                  ? `Primary technique: ${t}. Click to filter.`
                                  : `Secondary technique: ${t}. Click to filter.`
                              }
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="text-sm text-gray-600">{r.status}</div>
                </li>
              ))}
            </ul>

            {filteredRows.length === 0 && !err && (
              <p className="mt-6 text-gray-600">No rods match your filters.</p>
            )}
          </>
        )}
      </RodsListClient>
    </main>
  );
}
