import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import ProApplication from "@/models/ProApplication";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const applications = await ProApplication.find().sort({ createdAt: -1 }).lean();

  return NextResponse.json(
    applications.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      email: a.email,
      reason: a.reason,
      status: a.status,
      decidedBy: a.decidedBy,
      decidedAt: a.decidedAt,
      createdAt: a.createdAt,
    }))
  );
}
