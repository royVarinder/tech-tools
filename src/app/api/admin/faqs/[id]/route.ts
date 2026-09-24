import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Faq from "@/models/Faq";

const updateSchema = z.object({
  question: z.string().min(1).max(300).optional(),
  answer: z.string().min(1).max(2000).optional(),
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
    return NextResponse.json({ error: "Invalid FAQ data." }, { status: 400 });
  }

  await connectToDatabase();
  const faq = await Faq.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
  if (!faq) {
    return NextResponse.json({ error: "FAQ not found." }, { status: 404 });
  }

  return NextResponse.json({ id: faq._id.toString() });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await Faq.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "FAQ not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
