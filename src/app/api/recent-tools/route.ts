import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User, { type RecentToolEntry } from "@/models/User";
import { TOOL_DEFINITIONS } from "@/lib/toolsRegistry";

const MAX_RECENT = 6;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ tools: [] });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  const recentTools = (user?.recentTools ?? []) as RecentToolEntry[];
  const slugs = recentTools
    .filter((entry) => TOOL_DEFINITIONS.some((def) => def.slug === entry.slug))
    .map((entry) => entry.slug);

  return NextResponse.json({ tools: slugs });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = body?.slug;
  if (typeof slug !== "string" || !TOOL_DEFINITIONS.some((def) => def.slug === slug)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  user.recentTools = [
    { slug, usedAt: new Date() },
    ...user.recentTools.filter((entry: RecentToolEntry) => entry.slug !== slug),
  ].slice(0, MAX_RECENT);

  await user.save();

  return NextResponse.json({ ok: true });
}
