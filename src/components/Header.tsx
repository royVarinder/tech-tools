"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, locales } from "@/i18n/routing";
import ThemeToggle from "./ThemeToggle";
import { FcSearch, FcMenu, FcCancel, FcLeave, FcUp, FcDown, FcGlobe } from "react-icons/fc";

interface ToolItem {
  slug: string;
}

export default function Header() {
  const t = useTranslations("header");
  const tTools = useTranslations("tools");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [tools, setTools] = useState<ToolItem[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tools")
      .then((res) => res.json())
      .then((data) => setTools(data))
      .catch(() => setTools([]));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredTools = query
    ? tools.filter((tool) =>
        tTools(`${tool.slug}.name` as never)
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : tools;

  function switchLocale(next: string) {
    router.replace(pathname, { locale: next });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-[#0c0c0d]">
            T
          </span>
          <span className="font-heading text-lg font-bold tracking-wide text-foreground">
            ToolNest
          </span>
        </Link>

        <div className="relative hidden md:block" ref={toolsRef}>
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
          >
            {t("tools")}
            {toolsOpen ? <FcUp className="h-4 w-4" /> : <FcDown className="h-4 w-4" />}
          </button>
          <div
            className={`brand-card absolute left-0 top-full mt-2 w-72 origin-top p-2 shadow-xl transition-all duration-200 ${
              toolsOpen
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-95 opacity-0"
            }`}
          >
            {tools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                onClick={() => setToolsOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft hover:text-brand-bright"
              >
                {tTools(`${tool.slug}.name` as never)}
              </Link>
            ))}
          </div>
        </div>

        <div className="relative ml-auto hidden flex-1 max-w-sm sm:block">
          <FcSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder={t("searchPlaceholder")}
            className="brand-input w-full py-2 pl-10 pr-4 text-sm"
          />
          <div
            className={`brand-card absolute left-0 top-full z-10 mt-2 w-full origin-top p-2 shadow-xl transition-all duration-200 ${
              searchOpen && query
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-95 opacity-0"
            }`}
          >
            {filteredTools.length === 0 && (
              <p className="px-3 py-2 text-sm text-dim">No tools found</p>
            )}
            {filteredTools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="block rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft hover:text-brand-bright"
              >
                {tTools(`${tool.slug}.name` as never)}
              </Link>
            ))}
          </div>
        </div>

        <div className="relative hidden sm:block">
          <FcGlobe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value)}
            className="rounded-full border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground"
            aria-label="Language"
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {localeNames[l]}
              </option>
            ))}
          </select>
        </div>

        <ThemeToggle />

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {status === "authenticated" && session?.user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-medium text-foreground sm:inline">
                {session.user.name}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
              >
                <FcLeave className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
              >
                {t("login")}
              </Link>
              <Link
                href="/signup"
                className="brand-pill-btn px-4 py-2 text-sm transition hover:scale-[1.03]"
              >
                {t("join")}
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 rounded-full p-2 text-foreground transition-colors hover:bg-surface-soft md:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <FcCancel className="h-5 w-5" /> : <FcMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-t border-border transition-all duration-300 md:hidden ${
          mobileOpen ? "max-h-96 opacity-100" : "max-h-0 border-t-0 opacity-0"
        }`}
      >
        <div className="px-4 py-3">
          <div className="relative mb-3">
            <FcSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="brand-input w-full py-2 pl-10 pr-4 text-sm"
            />
          </div>
          <div className="mb-3 grid grid-cols-1 gap-1">
            {filteredTools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft"
              >
                {tTools(`${tool.slug}.name` as never)}
              </Link>
            ))}
          </div>
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value)}
            className="w-full rounded-full border border-border bg-surface px-2 py-2 text-sm text-foreground"
            aria-label="Language"
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {localeNames[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
