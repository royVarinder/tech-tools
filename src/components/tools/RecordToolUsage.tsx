"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function RecordToolUsage({ slug }: { slug: string }) {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/recent-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => {});
  }, [slug, status]);

  return null;
}
