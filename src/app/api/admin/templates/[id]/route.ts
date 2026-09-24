import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Template from "@/models/Template";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  layoutKey: z.string().min(1).max(80).optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template data." }, { status: 400 });
  }

  await connectToDatabase();
  const template = await Template.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ id: template._id.toString() });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await Template.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
