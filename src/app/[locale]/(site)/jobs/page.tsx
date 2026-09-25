import { getTranslations } from "next-intl/server";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { queryJobs } from "@/lib/queryJobs";
import JobsBrowser from "@/components/JobsBrowser";

const PAGE_SIZE = 20;

export default async function JobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "jobs" });

  await connectToDatabase();
  await Job.deleteMany({ lastDate: { $lt: new Date() } });

  const { jobs, total, states } = await queryJobs({ filter: {}, page: 1, limit: PAGE_SIZE });

  const initialJobs = jobs.map((job) => ({
    id: String(job._id),
    title: job.title,
    posts: job.posts,
    board: job.board,
    qualification: job.qualification,
    advtNo: job.advtNo,
    state: job.state,
    postDate: job.postDate.toISOString(),
    lastDate: job.lastDate.toISOString(),
    applyLink: job.applyLink ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{t("pageTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("pageSubtitle")}</p>

      <JobsBrowser
        initialJobs={initialJobs}
        initialTotal={total}
        initialStates={states}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
