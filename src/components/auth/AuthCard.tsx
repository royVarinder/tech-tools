"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { FcBusinessman, FcInvite, FcLock } from "react-icons/fc";

type Mode = "login" | "signup";

export default function AuthCard({ mode }: { mode: Mode }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError(t("passwordMismatch"));
        return;
      }
      if (!acceptedTerms) {
        setError(t("acceptTermsError"));
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong.");
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="auth-bg-glow relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <Link href="/" className="absolute left-6 top-6 flex items-center gap-2 sm:left-10 sm:top-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-[#0c0c0d]">
          T
        </span>
        <span className="font-heading text-lg font-bold tracking-wide text-foreground">ToolNest</span>
      </Link>

      <div className="brand-card relative w-full max-w-md p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] sm:p-10">
        <h1 className="text-center font-heading text-lg font-bold tracking-wide text-foreground sm:text-xl">
          {t("welcomeHeading")}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-[11px] font-medium uppercase leading-relaxed tracking-wide text-muted">
          {isSignup ? t("signupSubtitle") : t("loginSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {isSignup && (
            <div className="relative">
              <FcBusinessman className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("name")}
                className="brand-input w-full px-5 pl-11 py-3 text-sm"
              />
            </div>
          )}

          <div className="relative">
            <FcInvite className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email")}
              className="brand-input w-full px-5 pl-11 py-3 text-sm"
            />
          </div>

          <div className="relative">
            <FcLock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")}
              className="brand-input w-full px-5 pl-11 pr-10 py-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
            </button>
          </div>

          {isSignup && (
            <div className="relative">
              <FcLock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("confirmPassword")}
                className="brand-input w-full px-5 pl-11 py-3 text-sm"
              />
            </div>
          )}

          {isSignup ? (
            <label className="flex select-none items-center gap-2 pl-1 text-sm text-muted">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface-soft accent-brand"
              />
              {t("terms")}
            </label>
          ) : (
            <label className="flex select-none items-center gap-2 pl-1 text-sm text-muted">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface-soft accent-brand"
              />
              {t("rememberMe")}
            </label>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="brand-pill-btn mt-2 w-full py-3 text-sm transition hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? "..." : isSignup ? t("signupButton") : t("loginButton")}
          </button>
        </form>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-muted">
          {isSignup ? t("switchToLogin") : t("switchToSignup")}{" "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-brand-light hover:underline">
            {isSignup ? t("loginLink") : t("signupLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
