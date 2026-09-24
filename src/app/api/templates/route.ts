import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const toolSlug = searchParams.get("toolSlug");
  if (!toolSlug) {
    return NextResponse.json([]);
  }

  await connectToDatabase();
  const templates = await Template.find({ toolSlug, active: true }).sort({ order: 1 }).lean();

  return NextResponse.json(
    templates.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      layoutKey: t.layoutKey,
      thumbnailUrl: t.thumbnailUrl,
      description: t.description,
    }))
  );
}
