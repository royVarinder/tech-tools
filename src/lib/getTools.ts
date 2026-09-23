import { connectToDatabase } from "@/lib/mongodb";
import Tool from "@/models/Tool";
import { TOOL_DEFINITIONS, type ToolDefinition } from "@/lib/toolsRegistry";

export async function getTools(): Promise<ToolDefinition[]> {
  try {
    await connectToDatabase();
    const tools = await Tool.find({ active: true }).sort({ order: 1 }).lean();
    if (tools.length > 0) {
      return tools.map((tool) => ({
        slug: tool.slug,
        category: tool.category as ToolDefinition["category"],
        icon: tool.icon,
        order: tool.order,
      }));
    }
  } catch (error) {
    console.error("Mongo unavailable, using static tool registry:", error);
  }
  return TOOL_DEFINITIONS;
}
