import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import ProApplication from "@/models/ProApplication";
import { sendAdminNotification, escapeHtml } from "@/lib/mail";

const applySchema = z.object({
  reason: z.string().min(10).max(1000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "You must be logged in to apply." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please write a bit more about why you want Pro access (at least 10 characters)." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const user = await User.findById(session.user.id).lean();
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (user.isPro) {
    return NextResponse.json({ error: "You already have Pro access." }, { status: 400 });
  }

  const pending = await ProApplication.findOne({ userId: user._id, status: "pending" });
  if (pending) {
    return NextResponse.json({ error: "You already have a pending application." }, { status: 400 });
  }

  await ProApplication.create({
    userId: user._id,
    name: user.name,
    email: user.email,
    reason: parsed.data.reason,
    status: "pending",
  });

  const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const safeName = escapeHtml(user.name);
  const safeEmail = escapeHtml(user.email);
  const safeReason = escapeHtml(parsed.data.reason);
  await sendAdminNotification({
    subject: `New Pro application from ${user.name}`,
    html: `<p><strong>${safeName}</strong> (${safeEmail}) applied for Pro access.</p><p>Reason: ${safeReason}</p><p><a href="${origin}/admin/pro-applications">Review in admin panel</a></p>`,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
