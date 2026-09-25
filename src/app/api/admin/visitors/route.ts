import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Visitor from "@/models/Visitor";
import { istDayBoundary } from "@/lib/istDate";

export async function GET(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const ip = searchParams.get("ip")?.trim();
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));

  await connectToDatabase();

  const and: Record<string, unknown>[] = [];

  if (q) {
    and.push({ $or: [{ ip: { $regex: q, $options: "i" } }, { "actions.path": { $regex: q, $options: "i" } }] });
  }

  if (ip) {
    and.push({ ip: { $regex: ip, $options: "i" } });
  }

  const lastSeenRange: Record<string, Date> = {};
  if (from) {
    const start = istDayBoundary(from, false);
    if (start) lastSeenRange.$gte = start;
  }
  if (to) {
    const end = istDayBoundary(to, true);
    if (end) lastSeenRange.$lte = end;
  }
  if (Object.keys(lastSeenRange).length > 0) {
    and.push({ lastSeenAt: lastSeenRange });
  }

  const filter = and.length > 0 ? { $and: and } : {};

  const [visitors, total] = await Promise.all([
    Visitor.find(filter)
      .sort({ lastSeenAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Visitor.countDocuments(filter),
  ]);

  return NextResponse.json({
    visitors: visitors.map((visitor) => ({
      id: visitor._id.toString(),
      ip: visitor.ip,
      visitCount: visitor.visitCount,
      firstSeenAt: visitor.firstSeenAt,
      lastSeenAt: visitor.lastSeenAt,
      actions: visitor.actions.slice(-20).reverse(),
    })),
    total,
    page,
    limit,
  });
}
