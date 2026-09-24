import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import ProApplication from "@/models/ProApplication";
import { Link } from "@/i18n/navigation";
import ProApplyForm from "@/components/ProApplyForm";

export default async function ProPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pro" });
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("loginRequiredTitle")}</h1>
        <p className="mt-2 text-muted">{t("loginRequiredSubtitle")}</p>
        <Link href="/login" className="brand-pill-btn mt-6 inline-block px-6 py-3 text-sm">
          {t("loginCta")}
        </Link>
      </div>
    );
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).lean();
  const latestApplication = await ProApplication.findOne({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  if (user?.isPro) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("alreadyProTitle")}</h1>
        <p className="mt-2 text-muted">
          {t("alreadyProSubtitle", {
            date: user.proSince ? new Date(user.proSince).toLocaleDateString() : "",
          })}
        </p>
      </div>
    );
  }

  if (latestApplication?.status === "pending") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("pendingTitle")}</h1>
        <p className="mt-2 text-muted">{t("pendingSubtitle")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{t("formTitle")}</h1>
      <p className="mt-2 text-muted">{t("formSubtitle")}</p>
      {latestApplication?.status === "rejected" && (
        <p className="mt-4 rounded-xl bg-surface-soft px-4 py-3 text-sm text-muted">
          {t("rejectedNotice")}
        </p>
      )}
      <ProApplyForm />
    </div>
  );
}
