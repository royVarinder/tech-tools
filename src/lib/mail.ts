import { Resend } from "resend";
import { connectToDatabase } from "@/lib/mongodb";
import Admin from "@/models/Admin";

export async function sendAdminNotification({
  subject,
  html,
}: {
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY not set — skipping admin notification email.");
    return;
  }

  try {
    await connectToDatabase();
    const adminEmails = await Admin.find().distinct("email");
    if (adminEmails.length === 0) {
      console.warn("[mail] No admin accounts found — skipping admin notification email.");
      return;
    }

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    await resend.emails.send({ from, to: adminEmails, subject, html });
  } catch (error) {
    console.error("[mail] Failed to send admin notification email:", error);
  }
}
