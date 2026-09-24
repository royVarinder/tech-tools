import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FcLeft } from "react-icons/fc";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { TOOL_DEFINITIONS } from "@/lib/toolsRegistry";
import ToolIcon from "@/components/ToolIcon";
import RecordToolUsage from "@/components/tools/RecordToolUsage";
import ImageToPdf from "@/components/tools/ImageToPdf";
import PngToJpg from "@/components/tools/PngToJpg";
import PdfToJpg from "@/components/tools/PdfToJpg";
import MergePdf from "@/components/tools/MergePdf";
import DeletePdfPage from "@/components/tools/DeletePdfPage";
import PhotoCropResize from "@/components/tools/PhotoCropResize";
import ResumeMaker from "@/components/tools/ResumeMaker";
import PassportPhoto from "@/components/tools/PassportPhoto";
import IdCardPrint from "@/components/tools/IdCardPrint";
import ProResumeMaker from "@/components/tools/ProResumeMaker";

export function generateStaticParams() {
  return TOOL_DEFINITIONS.map((tool) => ({ slug: tool.slug }));
}

async function renderTool(slug: string) {
  switch (slug) {
    case "jpg-to-pdf":
      return <ImageToPdf format="jpg" />;
    case "png-to-pdf":
      return <ImageToPdf format="png" />;
    case "png-to-jpg":
      return <PngToJpg />;
    case "pdf-to-jpg":
      return <PdfToJpg />;
    case "merge-pdf":
      return <MergePdf />;
    case "delete-pdf-page":
      return <DeletePdfPage />;
    case "photo-crop-resize":
      return <PhotoCropResize />;
    case "resume-maker":
      return <ResumeMaker />;
    case "passport-photo":
      return <PassportPhoto />;
    case "id-card-print":
      return <IdCardPrint />;
    case "pro-resume-maker": {
      const session = await auth();
      const isLoggedIn = Boolean(session?.user?.id);
      let isPro = false;
      if (isLoggedIn) {
        await connectToDatabase();
        const user = await User.findById(session!.user.id).lean();
        isPro = Boolean(user?.isPro);
      }
      return <ProResumeMaker isPro={isPro} isLoggedIn={isLoggedIn} />;
    }
    default:
      return null;
  }
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const definition = TOOL_DEFINITIONS.find((tool) => tool.slug === slug);
  if (!definition) notFound();

  const t = await getTranslations({ locale, namespace: "tools" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const toolUi = await renderTool(slug);
  if (!toolUi) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <RecordToolUsage slug={slug} />
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-bright transition-transform hover:-translate-x-0.5 hover:underline"
      >
        <FcLeft className="h-4 w-4" /> {tCommon("back")}
      </Link>

      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-soft">
          <ToolIcon slug={slug} className="h-7 w-7" />
        </span>
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {t(`${slug}.name` as never)}
        </h1>
      </div>
      <p className="mb-8 text-muted">{t(`${slug}.description` as never)}</p>

      {toolUi}
    </div>
  );
}
