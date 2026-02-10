import Link from "next/link";

type Crumb = { label: string; href?: string };

export function SectionHeader({
  title,
  subtitle,
  crumbs,
  navLinks,
  right,
}: {
  title: string;
  subtitle?: string | null;
  crumbs?: Crumb[] | null;
  navLinks?: { href: string; label: string }[] | null;
  right?: React.ReactNode;
}) {
  return (
    <header className="space-y-3">
      {crumbs && crumbs.length > 0 ? (
        <nav className="text-xs text-gray-500">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              const node = c.href && !isLast ? (
                <Link className="hover:underline" href={c.href}>
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? "text-gray-700" : ""}>{c.label}</span>
              );

              return (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {node}
                  {!isLast ? <span className="text-gray-300">/</span> : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      {navLinks && navLinks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {navLinks.map((l) => (
            <Link key={l.href} className="px-3 py-2 rounded border text-sm" href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
