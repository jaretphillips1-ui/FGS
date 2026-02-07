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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export default function RodLockerPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<RodRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent overlapping loads from leaving us stuck.
  const loadSeq = useRef(0);

  async function load() {
    const seq = ++loadSeq.current;
    setLoading(true);
    setErr(null);

    try {
      // Prefer session (local) over getUser() (network)
      const sessionRes = await withTimeout(
        supabase.auth.getSession(),
        6000,
        "auth.getSession()"
      );

      const session = sessionRes.data.session;
      const user = session?.user ?? null;

      if (!user) {
        setUserEmail(null);
        setRows([]);
        return;
      }

      setUserEmail(user.email ?? null);

      const queryRes = await withTimeout(
        supabase
          .from("gear_items")
          .select("id,name,status,created_at,rod_techniques")
          .eq("gear_type", "rod")
          .order("created_at", { ascending: false }),
        8000,
        "gear_items select"
      );

      if (queryRes.error) {
        setErr(queryRes.error.message);
        setRows([]);
        return;
      }

      setRows((queryRes.data ?? []) as RodRow[]);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error while loading rods.");
      setRows([]);
      setUserEmail(null);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
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
    await load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    await load();
  }

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <main className="p-6">Loading…</main>;

  if (!userEmail) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Rod Locker</h1>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <p className="mt-2 text-gray-600">You need to sign in first.</p>
        <Link className="inline-block mt-4 underline" href="/login">
          Go to login
        </Link>

        <div className="mt-6">
          <button className="px-4 py-2 rounded border" onClick={load}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rod Locker</h1>
          <p className="text-sm text-gray-600">Signed in as {userEmail}</p>
        </div>
        <button className="px-3 py-2 rounded border" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          className="px-4 py-2 rounded bg-black text-white"
          onClick={addTestRod}
        >
          Add Test Rod
        </button>

        <button
          className="px-4 py-2 rounded border"
          onClick={() => router.push("/rods/new")}
        >
          New Rod
        </button>

        <button className="px-4 py-2 rounded border" onClick={load}>
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
                    const secondarySorted = sortTechniques(techs).filter(
                      (t) => t !== primary
                    );

                    // Render order: [primary, ...secondary]
                    const display = primary
                      ? [primary, ...secondarySorted]
                      : secondarySorted;

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
