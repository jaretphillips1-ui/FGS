type SourceLinkProps = {
  href: string;
  label?: string;
  className?: string;
  title?: string;
};

function safeUrl(raw: string): string {
  return String(raw ?? "").trim();
}

function shortUrlLabel(raw: string): string {
  const s = safeUrl(raw);
  try {
    const u = new URL(s);
    const host = u.host.replace(/^www\./i, "");
    const path = (u.pathname ?? "") + (u.search ?? "");
    if (!path || path === "/") return host;

    const trimmed = path.length > 26 ? `${path.slice(0, 23)}…` : path;
    return `${host}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  } catch {
    const noProto = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    if (noProto.length <= 32) return noProto;
    return `${noProto.slice(0, 28)}…`;
  }
}

export function SourceLink({ href, label, className, title }: SourceLinkProps) {
  const url = safeUrl(href);
  if (!url) return null;

  const text = label?.trim() ? label.trim() : shortUrlLabel(url);
  const cls =
    className ??
    "underline underline-offset-2 text-blue-700 hover:text-blue-900 break-all";

  return (
    <a
      className={cls}
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={title ?? url}
    >
      {text}
    </a>
  );
}
