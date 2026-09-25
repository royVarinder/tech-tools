import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { buildJobFilter, queryJobs } from "@/lib/queryJobs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const state = searchParams.get("state")?.trim();
  const date = searchParams.get("date")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  await connectToDatabase();

  // Defensive cleanup — the TTL index handles this eventually, but a sweep can lag up to ~60s.
  await Job.deleteMany({ lastDate: { $lt: new Date() } });

  const filter = buildJobFilter({ q, state, date });
  const { jobs, total, states } = await queryJobs({ filter, page, limit });

  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: String(job._id),
      title: job.title,
      posts: job.posts,
      board: job.board,
      qualification: job.qualification,
      advtNo: job.advtNo,
      state: job.state,
      postDate: job.postDate,
      lastDate: job.lastDate,
      applyLink: job.applyLink ?? null,
    })),
    total,
    page,
    limit,
    states,
  });
}
