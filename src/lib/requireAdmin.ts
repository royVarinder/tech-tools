import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/admin/login");
  }
  return session;
}

export async function requireAdminApi(): Promise<NextResponse | null> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
