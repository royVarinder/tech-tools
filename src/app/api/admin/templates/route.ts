import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";

const createSchema = z.object({
  toolSlug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  layoutKey: z.string().min(1).max(80),
  thumbnailUrl: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const templates = await Template.find().sort({ toolSlug: 1, order: 1 }).lean();

  return NextResponse.json(
    templates.map((t) => ({
      id: t._id.toString(),
      toolSlug: t.toolSlug,
      name: t.name,
      layoutKey: t.layoutKey,
      thumbnailUrl: t.thumbnailUrl,
      description: t.description,
      order: t.order,
      active: t.active,
    }))
  );
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template data." }, { status: 400 });
  }

  await connectToDatabase();
  const count = await Template.countDocuments({ toolSlug: parsed.data.toolSlug });
  const template = await Template.create({
    ...parsed.data,
    thumbnailUrl: parsed.data.thumbnailUrl ?? null,
    description: parsed.data.description ?? null,
    order: count,
  });

  return NextResponse.json({ id: template._id.toString() }, { status: 201 });
}
