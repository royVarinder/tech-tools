"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("admin-login", { email, password, redirect: false });
    if (result?.error) {
      setError("Invalid admin email or password.");
      setLoading(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className="brand-card w-full max-w-sm p-8">
        <h1 className="text-center font-heading text-lg font-bold text-foreground">Admin Login</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className="brand-input w-full px-4 py-3 text-sm"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="brand-input w-full px-4 py-3 text-sm"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="brand-pill-btn w-full py-3 text-sm disabled:opacity-70"
          >
            {loading ? "..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
