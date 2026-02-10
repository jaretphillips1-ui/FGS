import { MANUFACTURERS } from "@/lib/manufacturers";
import { SectionHeader } from "@/components/SectionHeader";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Page() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <SectionHeader
        title="Manufacturers"
        subtitle="Brands you use (and a quick jump to their main pages)."
        navLinks={[
          { href: "/rods", label: "Rods" },
          { href: "/reels", label: "Reels" },
          { href: "/combos", label: "Combos" },
          { href: "/lures", label: "Lures" },
          { href: "/shopping", label: "Shopping" },
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {MANUFACTURERS.map((m) => (
          <a
            key={m.key}
            href={m.website}
            target="_blank"
            rel="noreferrer"
            className="border rounded p-4 bg-white hover:bg-gray-50 flex items-center gap-3"
            title={m.website}
          >
            {m.logoSrc ? (
              // We’ll wire real logos later once you drop them into /public.
              <div className="h-12 w-12 rounded bg-gray-50 border border-gray-200 grid place-items-center overflow-hidden">
                <img src={m.logoSrc} alt={`${m.name} logo`} className="max-h-10 max-w-10" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded bg-gray-900 text-white grid place-items-center font-semibold">
                {initials(m.name)}
              </div>
            )}

            <div className="min-w-0">
              <div className="font-medium truncate">{m.name}</div>
              <div className="text-xs text-gray-500 truncate">{m.website}</div>
            </div>
          </a>
        ))}
      </div>

      <div className="border rounded p-4 bg-white text-sm text-gray-700">
        Add brands by editing{" "}
        <span className="font-mono text-xs bg-gray-50 border px-1 py-0.5 rounded">
          src/lib/manufacturers.ts
        </span>{" "}
        — one entry per manufacturer.
      </div>
    </main>
  );
}
