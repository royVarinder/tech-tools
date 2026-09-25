import { NextResponse } from "next/server";
import { z } from "zod";
import { requireJobsWriteAccess } from "@/lib/requireJobsAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { istDayBoundary } from "@/lib/istDate";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  posts: z.coerce.number().int().min(1).optional(),
  board: z.string().min(1).max(200).optional(),
  qualification: z.string().min(1).max(300).optional(),
  advtNo: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "postDate must be YYYY-MM-DD").optional(),
  lastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "lastDate must be YYYY-MM-DD").optional(),
  applyLink: z.string().url().max(2000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireJobsWriteAccess(request);
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job data.", details: parsed.error.flatten() }, { status: 400 });
  }

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.postDate) {
    const postDate = istDayBoundary(parsed.data.postDate, false);
    if (!postDate) return NextResponse.json({ error: "Invalid postDate." }, { status: 400 });
    update.postDate = postDate;
  }
  if (parsed.data.lastDate) {
    const lastDate = istDayBoundary(parsed.data.lastDate, true);
    if (!lastDate) return NextResponse.json({ error: "Invalid lastDate." }, { status: 400 });
    update.lastDate = lastDate;
  }

  await connectToDatabase();
  const job = await Job.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({ id: job._id.toString() });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireJobsWriteAccess(request);
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await Job.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
