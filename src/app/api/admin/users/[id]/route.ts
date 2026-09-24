import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid name or email." }, { status: 400 });
  }

  await connectToDatabase();
  const update: Record<string, string> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.email) update.email = parsed.data.email.toLowerCase();

  const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ id: user._id.toString(), name: user.name, email: user.email });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  await connectToDatabase();
  const result = await User.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
