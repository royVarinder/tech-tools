import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/requireAdmin";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ProApplication from "@/models/ProApplication";
import User from "@/models/User";

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  await connectToDatabase();
  const application = await ProApplication.findById(id);
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const session = await auth();
  const status = parsed.data.action === "approve" ? "approved" : "rejected";

  application.status = status;
  application.decidedBy = session?.user?.name ?? "Admin";
  application.decidedAt = new Date();
  await application.save();

  if (status === "approved") {
    await User.findByIdAndUpdate(application.userId, {
      $set: { isPro: true, proSince: new Date() },
    });
  }

  return NextResponse.json({ id: application._id.toString(), status });
}
