import { useTranslations } from "next-intl";

export default function AboutSection() {
  const t = useTranslations("about");

  return (
    <section className="border-t border-border bg-surface-soft">
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <h2 className="mb-4 text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mb-4 text-muted">{t("paragraph1")}</p>
        <p className="text-muted">{t("paragraph2")}</p>
      </div>
    </section>
  );
}
