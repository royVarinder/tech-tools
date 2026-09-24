import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Faq from "@/models/Faq";

const createSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
});

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const faqs = await Faq.find().sort({ order: 1 }).lean();

  return NextResponse.json(
    faqs.map((f) => ({
      id: f._id.toString(),
      question: f.question,
      answer: f.answer,
      order: f.order,
      active: f.active,
    }))
  );
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid FAQ data." }, { status: 400 });
  }

  await connectToDatabase();
  const count = await Faq.countDocuments();
  const faq = await Faq.create({ ...parsed.data, order: count });

  return NextResponse.json({ id: faq._id.toString() }, { status: 201 });
}
