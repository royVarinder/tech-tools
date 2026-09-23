import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");
  const tMeta = useTranslations("meta");

  return (
    <footer className="border-t border-border bg-surface-soft">
      <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted sm:px-6">
        <p className="mb-2 font-heading font-semibold text-foreground">{tMeta("siteName")}</p>
        <p>
          © {new Date().getFullYear()} {tMeta("siteName")}. {t("rights")}
        </p>
        <p className="mt-2">
          <Link href="/" className="hover:text-brand-bright">
            {tMeta("siteName")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
