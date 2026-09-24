"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/visitors", label: "Visitors" },
  { href: "/admin/portal-links", label: "Portal Links" },
  { href: "/admin/faqs", label: "FAQs" },
];

export default function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface px-4 py-6 sm:block">
        <p className="mb-6 font-heading text-sm font-bold text-foreground">PrintBro Admin</p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-sm text-muted">Signed in as {adminName}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
          >
            Log out
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
