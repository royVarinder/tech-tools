import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const users = await User.find().sort({ createdAt: -1 }).lean();

  return NextResponse.json(
    users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      recentToolsCount: user.recentTools?.length ?? 0,
    }))
  );
}
