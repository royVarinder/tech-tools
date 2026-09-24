import { requireAdminPage } from "@/lib/requireAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Faq from "@/models/Faq";
import AdminShell from "@/components/admin/AdminShell";
import FaqsManager from "@/components/admin/FaqsManager";

export default async function AdminFaqsPage() {
  const session = await requireAdminPage();

  await connectToDatabase();
  const faqs = await Faq.find().sort({ order: 1 }).lean();

  const initialFaqs = faqs.map((f) => ({
    id: f._id.toString(),
    question: f.question,
    answer: f.answer,
    active: f.active,
  }));

  return (
    <AdminShell adminName={session.user.name ?? "Admin"}>
      <h1 className="font-heading text-xl font-bold text-foreground">FAQs</h1>
      <FaqsManager initialFaqs={initialFaqs} />
    </AdminShell>
  );
}
