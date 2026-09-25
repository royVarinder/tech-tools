import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import { getVisitorStats } from "@/lib/visitorStats";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const stats = await getVisitorStats();

  return NextResponse.json(stats);
}
