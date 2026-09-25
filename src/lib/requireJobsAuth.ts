import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Allows admin-session requests (browser) or a shared secret via `x-jobs-api-key` header (curl/scripts). */
export async function requireJobsWriteAccess(request: Request): Promise<NextResponse | null> {
  const providedKey = request.headers.get("x-jobs-api-key");
  const expectedKey = process.env.JOBS_API_KEY;
  if (providedKey && expectedKey && providedKey === expectedKey) {
    return null;
  }

  const session = await auth();
  if (session?.user?.role === "admin") {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
