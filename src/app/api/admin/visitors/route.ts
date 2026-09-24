import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Visitor from "@/models/Visitor";

export async function GET(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  await connectToDatabase();
  const filter = q
    ? { $or: [{ ip: { $regex: q, $options: "i" } }, { "actions.path": { $regex: q, $options: "i" } }] }
    : {};

  const visitors = await Visitor.find(filter).sort({ lastSeenAt: -1 }).limit(200).lean();

  return NextResponse.json(
    visitors.map((visitor) => ({
      id: visitor._id.toString(),
      ip: visitor.ip,
      visitCount: visitor.visitCount,
      firstSeenAt: visitor.firstSeenAt,
      lastSeenAt: visitor.lastSeenAt,
      actions: visitor.actions.slice(-20).reverse(),
    }))
  );
}
