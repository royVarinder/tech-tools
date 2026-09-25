import Visitor from "@/models/Visitor";

const DAYS = 30;

export interface VisitorStats {
  totalVisitors: number;
  totalVisits: number;
  daily: { date: string; count: number }[];
}

export async function getVisitorStats(): Promise<VisitorStats> {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const [totalVisitors, totalVisitsAgg, dailyAgg] = await Promise.all([
    Visitor.countDocuments(),
    Visitor.aggregate([{ $group: { _id: null, total: { $sum: "$visitCount" } } }]),
    Visitor.aggregate([
      { $unwind: "$actions" },
      { $match: { "actions.at": { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$actions.at", timezone: "Asia/Kolkata" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const totalVisits = totalVisitsAgg[0]?.total ?? 0;

  const byDate = new Map<string, number>(dailyAgg.map((row) => [row._id as string, row.count as number]));
  const daily: { date: string; count: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    daily.push({ date: key, count: byDate.get(key) ?? 0 });
  }

  return { totalVisitors, totalVisits, daily };
}
