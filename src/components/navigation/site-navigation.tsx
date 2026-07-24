"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/setup", label: "Setup" },
  { href: "/replay", label: "Replay" },
];

export function SiteNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/display")) return null;

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 h-16 border-b backdrop-blur">
      <nav
        aria-label="ChalkPilot"
        className="mx-auto flex h-full max-w-[96rem] items-center justify-between gap-6 px-5 lg:px-8"
      >
        <Link className="text-lg font-semibold tracking-tight" href="/setup">
          ChalkPilot
        </Link>
        <div className="flex items-center gap-1">
          {pathname === "/session" ? (
            <span
              aria-current="page"
              className="bg-surface-muted rounded-lg px-3 py-2 text-sm font-semibold"
            >
              Live session
            </span>
          ) : null}
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-surface-muted" : "hover:bg-surface-muted"
                }`}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
