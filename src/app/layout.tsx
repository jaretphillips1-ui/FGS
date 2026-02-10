import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FGS",
  description: "Fishing Gear System",
};

const NAV = [
  { href: "/rods", label: "Rods" },
  { href: "/reels", label: "Reels" },
  { href: "/combos", label: "Combos" },
  { href: "/lures", label: "Lures" },

  { href: "/shopping", label: "Shopping" },
  { href: "/manufacturers", label: "Manufacturers" },

  { href: "/terminal", label: "Terminal" },
  { href: "/line", label: "Line" },
  { href: "/toolbox", label: "Toolbox" },
  { href: "/electronics", label: "Electronics" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/rods" className="font-semibold">
              FGS
            </Link>

            <nav className="flex flex-wrap items-center gap-2">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
