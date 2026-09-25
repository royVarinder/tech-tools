import { NextResponse } from "next/server";
import { z } from "zod";
import { requireJobsWriteAccess } from "@/lib/requireJobsAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { istDayBoundary } from "@/lib/istDate";
import { sendJobAlertEmail } from "@/lib/mail";

const jobSchema = z.object({
  title: z.string().min(1).max(200),
  posts: z.coerce.number().int().min(1).default(1),
  board: z.string().min(1).max(200),
  qualification: z.string().min(1).max(300),
  advtNo: z.string().min(1).max(100),
  state: z.string().min(1).max(100).default("All India"),
  postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "postDate must be YYYY-MM-DD"),
  lastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "lastDate must be YYYY-MM-DD"),
  applyLink: z.string().url().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const guard = await requireJobsWriteAccess(request);
  if (guard) return guard;

  await connectToDatabase();
  const jobs = await Job.find().sort({ lastDate: -1 }).lean();

  return NextResponse.json(
    jobs.map((job) => ({
      id: job._id.toString(),
      title: job.title,
      posts: job.posts,
      board: job.board,
      qualification: job.qualification,
      advtNo: job.advtNo,
      state: job.state,
      postDate: job.postDate,
      lastDate: job.lastDate,
      applyLink: job.applyLink ?? null,
    }))
  );
}

export async function POST(request: Request) {
  const guard = await requireJobsWriteAccess(request);
  if (guard) return guard;

  const body = await request.json().catch(() => null);
  const parsed = jobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid job data.", details: parsed.error.flatten() }, { status: 400 });
  }

  const postDate = istDayBoundary(parsed.data.postDate, false);
  const lastDate = istDayBoundary(parsed.data.lastDate, true);
  if (!postDate || !lastDate) {
    return NextResponse.json({ error: "Invalid postDate/lastDate." }, { status: 400 });
  }
  if (lastDate < new Date()) {
    return NextResponse.json({ error: "lastDate has already passed." }, { status: 400 });
  }

  await connectToDatabase();
  const job = await Job.create({
    title: parsed.data.title,
    posts: parsed.data.posts,
    board: parsed.data.board,
    qualification: parsed.data.qualification,
    advtNo: parsed.data.advtNo,
    state: parsed.data.state,
    postDate,
    lastDate,
    applyLink: parsed.data.applyLink ?? null,
  });

  await sendJobAlertEmail(job);

  return NextResponse.json({ id: job._id.toString() }, { status: 201 });
}
