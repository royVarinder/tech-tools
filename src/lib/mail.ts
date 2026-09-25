import { Resend } from "resend";
import { connectToDatabase } from "@/lib/mongodb";
import Admin from "@/models/Admin";
import User from "@/models/User";
import { formatISTDate } from "@/lib/formatDate";
import type { JobDoc } from "@/models/Job";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

const JOB_ALERT_BATCH_SIZE = 45;

/** Emails every registered user (bcc, batched) about a newly posted job. */
export async function sendJobAlertEmail(job: Pick<JobDoc, "title" | "posts" | "board" | "qualification" | "advtNo" | "state" | "postDate" | "lastDate" | "applyLink">): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY not set — skipping job alert email.");
    return;
  }

  try {
    await connectToDatabase();
    const emails = await User.find().distinct("email");
    if (emails.length === 0) {
      console.warn("[mail] No registered users — skipping job alert email.");
      return;
    }

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const safeApplyLink = job.applyLink && /^https?:\/\//i.test(job.applyLink) ? job.applyLink : null;
    const html = `
      <h2>${escapeHtml(job.title)}</h2>
      <p><strong>Posts:</strong> ${job.posts}</p>
      <p><strong>Board:</strong> ${escapeHtml(job.board)}</p>
      <p><strong>Qualification:</strong> ${escapeHtml(job.qualification)}</p>
      <p><strong>Advt No:</strong> ${escapeHtml(job.advtNo)}</p>
      <p><strong>State:</strong> ${escapeHtml(job.state)}</p>
      <p><strong>Post Date:</strong> ${formatISTDate(job.postDate)}</p>
      <p><strong>Last Date:</strong> ${formatISTDate(job.lastDate)}</p>
      ${safeApplyLink ? `<p><a href="${escapeHtml(safeApplyLink)}">Apply here</a></p>` : ""}
      <p>Check it out on the Latest Jobs portal.</p>
    `;

    for (let i = 0; i < emails.length; i += JOB_ALERT_BATCH_SIZE) {
      const batch = emails.slice(i, i + JOB_ALERT_BATCH_SIZE);
      await resend.emails.send({ from, to: from, bcc: batch, subject: `New Job Posted: ${job.title}`, html });
    }
  } catch (error) {
    console.error("[mail] Failed to send job alert email:", error);
  }
}
