import { connectToDatabase } from "@/lib/mongodb";
import User, { type RecentToolEntry } from "@/models/User";
import { TOOL_DEFINITIONS } from "@/lib/toolsRegistry";

export async function getRecentTools(userId: string): Promise<string[]> {
  try {
    await connectToDatabase();
    const user = await User.findById(userId).lean();
    const recentTools = (user?.recentTools ?? []) as RecentToolEntry[];
    return recentTools
      .filter((entry) => TOOL_DEFINITIONS.some((def) => def.slug === entry.slug))
      .map((entry) => entry.slug);
  } catch (error) {
    console.error("Could not load recent tools:", error);
    return [];
  }
}
