import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ToolIcon from "./ToolIcon";

export default function ToolCard({ slug, showDescription = true }: { slug: string; showDescription?: boolean }) {
  const t = useTranslations("tools");

  return (
    <Link
      href={`/tools/${slug}`}
      className="brand-card group flex flex-col gap-3 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-light hover:shadow-[0_12px_24px_-12px_var(--color-brand)]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft transition-transform duration-200 group-hover:scale-110">
        <ToolIcon slug={slug} className="h-7 w-7" />
      </span>
      <div>
        <h3 className="font-heading font-semibold text-foreground">{t(`${slug}.name` as never)}</h3>
        {showDescription && <p className="mt-1 text-sm text-muted">{t(`${slug}.description` as never)}</p>}
      </div>
    </Link>
  );
}
