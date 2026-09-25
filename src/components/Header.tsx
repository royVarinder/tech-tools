"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, locales } from "@/i18n/routing";
import ThemeToggle from "./ThemeToggle";
import { FiMenu, FiX } from "react-icons/fi";
import { FcSearch, FcLeave, FcUp, FcDown, FcGlobe } from "react-icons/fc";

interface ToolItem {
  slug: string;
}

interface ServiceItem {
  slug: string;
  title: string;
  href: string | null;
  externalUrl: string | null;
}

interface SearchResult {
  key: string;
  title: string;
  href: string | null;
  externalUrl: string | null;
}

export default function Header() {
  const t = useTranslations("header");
  const tTools = useTranslations("tools");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [tools, setTools] = useState<ToolItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tools")
      .then((res) => res.json())
      .then((data) => setTools(data))
      .catch(() => setTools([]));

    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch(() => setServices([]));
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

  useEffect(() => {
    if (!drawerOpen) return;

    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const filteredTools = query
    ? tools.filter((tool) =>
        tTools(`${tool.slug}.name` as never)
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : tools;

  const filteredServices = query
    ? services.filter((service) => service.title.toLowerCase().includes(query.toLowerCase()))
    : [];

  const searchResults: SearchResult[] = query
    ? [
        ...filteredTools.map((tool) => ({
          key: `tool-${tool.slug}`,
          title: tTools(`${tool.slug}.name` as never),
          href: `/tools/${tool.slug}`,
          externalUrl: null,
        })),
        ...filteredServices.map((service) => ({
          key: `service-${service.slug}`,
          title: service.title,
          href: service.href,
          externalUrl: service.externalUrl,
        })),
      ]
    : [];

  function switchLocale(next: string) {
    router.replace(pathname, { locale: next });
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/applogo.png"
              alt="PrintBro"
              width={175}
              height={70}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>

          <div className="relative hidden md:block" ref={toolsRef}>
            <button
              type="button"
              onClick={() => setToolsOpen((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
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

          <div className="relative ml-auto hidden flex-1 max-w-sm md:block">
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
              {searchResults.length === 0 && (
                <p className="px-3 py-2 text-sm text-dim">No results found</p>
              )}
              {searchResults.map((result) =>
                result.externalUrl ? (
                  <a
                    key={result.key}
                    href={result.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft hover:text-brand-bright"
                  >
                    {result.title}
                  </a>
                ) : (
                  <Link
                    key={result.key}
                    href={result.href ?? "#"}
                    className="block rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft hover:text-brand-bright"
                  >
                    {result.title}
                  </Link>
                )
              )}
            </div>
          </div>

          <div className="hidden items-center gap-2 md:ml-0 md:flex">
            <div className="relative">
              <FcGlobe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <select
                value={locale}
                onChange={(e) => switchLocale(e.target.value)}
                className="rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground"
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

            {status === "authenticated" && session?.user ? (
              <div className="flex items-center gap-2">
                {!session.user.isPro && (
                  <Link
                    href="/pro"
                    className="rounded-lg border border-brand-light px-3 py-2 text-sm font-medium text-brand-bright transition-colors hover:bg-surface-soft"
                  >
                    {t("goPro")}
                  </Link>
                )}
                <span className="text-sm font-medium text-foreground">
                  {session.user.name}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
                >
                  <FcLeave className="h-4 w-4" />
                  <span>Log out</span>
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
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
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-soft md:hidden"
            aria-label="Open menu"
          >
            <FiMenu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 md:hidden ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col border-l border-border bg-background shadow-xl transition-transform duration-300 md:hidden ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-heading text-base font-bold tracking-wide text-foreground">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-soft"
            aria-label="Close menu"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="relative mb-4">
            <FcSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="brand-input w-full py-2 pl-10 pr-4 text-sm"
            />
          </div>

          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-dim">
            {t("tools")}
          </p>
          <div className="mb-4 grid grid-cols-1 gap-1">
            {filteredTools.length === 0 && (
              <p className="px-3 py-2 text-sm text-dim">No tools found</p>
            )}
            {filteredTools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft"
              >
                {tTools(`${tool.slug}.name` as never)}
              </Link>
            ))}
          </div>

          {query && filteredServices.length > 0 && (
            <>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-dim">
                Portal Services
              </p>
              <div className="mb-4 grid grid-cols-1 gap-1">
                {filteredServices.map((service) =>
                  service.externalUrl ? (
                    <a
                      key={service.slug}
                      href={service.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setDrawerOpen(false)}
                      className="rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft"
                    >
                      {service.title}
                    </a>
                  ) : (
                    <Link
                      key={service.slug}
                      href={service.href ?? "#"}
                      onClick={() => setDrawerOpen(false)}
                      className="rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-soft"
                    >
                      {service.title}
                    </Link>
                  )
                )}
              </div>
            </>
          )}

          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <FcGlobe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <select
                value={locale}
                onChange={(e) => switchLocale(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground"
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
          </div>

          <div className="border-t border-border pt-4">
            {status === "authenticated" && session?.user ? (
              <div className="space-y-3">
                {!session.user.isPro && (
                  <Link
                    href="/pro"
                    onClick={() => setDrawerOpen(false)}
                    className="block rounded-lg border border-brand-light px-3 py-2 text-center text-sm font-medium text-brand-bright transition-colors hover:bg-surface-soft"
                  >
                    {t("goPro")}
                  </Link>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {session.user.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      signOut();
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
                  >
                    <FcLeave className="h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-surface-soft"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setDrawerOpen(false)}
                  className="brand-pill-btn px-4 py-2 text-center text-sm transition hover:scale-[1.03]"
                >
                  {t("join")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
