import { connectToDatabase } from "@/lib/mongodb";
import Visitor, { type VisitorAction } from "@/models/Visitor";

const MAX_ACTIONS_PER_IP = 500;

export async function recordVisit(ip: string, action: Omit<VisitorAction, "at">) {
  try {
    await connectToDatabase();

    const now = new Date();
    await Visitor.findOneAndUpdate(
      { ip },
      {
        $push: {
          actions: {
            $each: [{ ...action, at: now }],
            $slice: -MAX_ACTIONS_PER_IP,
          },
        },
        $set: { lastSeenAt: now },
        $setOnInsert: { firstSeenAt: now },
        $inc: { visitCount: 1 },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[trackVisit] failed to record visit:", err);
  }
}
