import Job, { type JobDoc } from "@/models/Job";
import { istDayBoundary, istTodayDateString } from "@/lib/istDate";

export interface JobFilterOptions {
  q?: string;
  state?: string;
  date?: string;
}

export function buildJobFilter({ q, state, date }: JobFilterOptions): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  if (q) {
    and.push({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { board: { $regex: q, $options: "i" } },
        { qualification: { $regex: q, $options: "i" } },
        { advtNo: { $regex: q, $options: "i" } },
      ],
    });
  }

  if (state && state !== "all") {
    and.push({ state: { $regex: `^${state}$`, $options: "i" } });
  }

  if (date) {
    const start = istDayBoundary(date, false);
    const end = istDayBoundary(date, true);
    if (start && end) {
      and.push({ postDate: { $gte: start, $lte: end } });
    }
  }

  return and.length > 0 ? { $and: and } : {};
}

export interface QueriedJob extends Omit<JobDoc, "_id"> {
  _id: unknown;
}

/** Fetches a page of jobs with jobs closing today pinned to the top, then sorted by lastDate descending. */
export async function queryJobs({
  filter,
  page,
  limit,
}: {
  filter: Record<string, unknown>;
  page: number;
  limit: number;
}): Promise<{ jobs: QueriedJob[]; total: number; states: string[] }> {
  const todayStr = istTodayDateString();
  const todayStart = istDayBoundary(todayStr, false)!;
  const todayEnd = istDayBoundary(todayStr, true)!;

  const [jobs, total, states] = await Promise.all([
    Job.aggregate<QueriedJob>([
      { $match: filter },
      {
        $addFields: {
          isClosingToday: { $and: [{ $gte: ["$lastDate", todayStart] }, { $lte: ["$lastDate", todayEnd] }] },
        },
      },
      { $sort: { isClosingToday: -1, lastDate: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]),
    Job.countDocuments(filter),
    Job.distinct("state"),
  ]);

  return { jobs, total, states: states.sort((a: string, b: string) => a.localeCompare(b)) };
}
