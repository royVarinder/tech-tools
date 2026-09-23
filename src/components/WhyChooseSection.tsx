import { useTranslations } from "next-intl";
import { FcFlashOn, FcOrganization, FcPrivacy, FcCurrencyExchange } from "react-icons/fc";

const CARDS = [
  { key: 1, icon: FcFlashOn },
  { key: 2, icon: FcOrganization },
  { key: 3, icon: FcPrivacy },
  { key: 4, icon: FcCurrencyExchange },
] as const;

export default function WhyChooseSection() {
  const t = useTranslations("whyChoose");

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <h2 className="mb-8 text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
        {t("title")}
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="brand-card flex flex-col items-start gap-3 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand-light hover:shadow-md"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="font-heading font-semibold text-foreground">
              {t(`card${key}Title` as never)}
            </h3>
            <p className="text-sm text-muted">{t(`card${key}Desc` as never)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
