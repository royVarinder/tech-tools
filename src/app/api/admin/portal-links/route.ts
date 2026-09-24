import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Service from "@/models/Service";

const createSchema = z.object({
  slug: z.string().min(1).max(80),
  categorySlug: z.string().min(1),
  title: z.string().min(1).max(120),
  externalUrl: z.string().url().nullable().optional(),
});

export async function GET() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  await connectToDatabase();
  const services = await Service.find().sort({ categorySlug: 1, order: 1 }).lean();

  return NextResponse.json(
    services.map((s) => ({
      id: s._id.toString(),
      slug: s.slug,
      categorySlug: s.categorySlug,
      title: s.title,
      badge: s.badge,
      href: s.href,
      externalUrl: s.externalUrl ?? null,
      order: s.order,
      active: s.active,
    }))
  );
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid portal link data." }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Service.findOne({ slug: parsed.data.slug });
  if (existing) {
    return NextResponse.json({ error: "A service with this slug already exists." }, { status: 409 });
  }

  const service = await Service.create({
    slug: parsed.data.slug,
    categorySlug: parsed.data.categorySlug,
    title: parsed.data.title,
    externalUrl: parsed.data.externalUrl ?? null,
    badge: null,
    href: null,
    order: 0,
    active: true,
  });

  return NextResponse.json({ id: service._id.toString() }, { status: 201 });
}
