import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Tool from "@/models/Tool";
import { TOOL_DEFINITIONS } from "@/lib/toolsRegistry";

export async function GET() {
  try {
    await connectToDatabase();
    const tools = await Tool.find({ active: true }).sort({ order: 1 }).lean();

    if (tools.length > 0) {
      return NextResponse.json(
        tools.map((tool) => ({
          slug: tool.slug,
          category: tool.category,
          icon: tool.icon,
          order: tool.order,
        }))
      );
    }
  } catch (error) {
    console.error("Falling back to static tool registry:", error);
  }

  return NextResponse.json(TOOL_DEFINITIONS);
}
