import { useTranslations } from "next-intl";
import { FcBriefcase } from "react-icons/fc";
import { auth } from "@/auth";
import { getRecentTools } from "@/lib/getRecentTools";
import { getHomeContent, type HomeContent } from "@/lib/getHomeContent";
import { Link } from "@/i18n/navigation";
import ToolCard from "@/components/ToolCard";
import CategorySection from "@/components/CategorySection";
import AboutSection from "@/components/AboutSection";
import WhyChooseSection from "@/components/WhyChooseSection";
import FAQ from "@/components/FAQ";
import HeroFeatureCarousel from "@/components/HeroFeatureCarousel";

export default async function HomePage() {
  const [content, session] = await Promise.all([getHomeContent(), auth()]);
  const userId = session?.user?.id ?? null;
  const recentSlugs = userId ? await getRecentTools(userId) : [];

  return (
    <HomeSections
      content={content}
      userName={session?.user?.name ?? null}
      recentSlugs={recentSlugs}
    />
  );
}

function HomeSections({
  content,
  userName,
  recentSlugs,
}: {
  content: HomeContent;
  userName: string | null;
  recentSlugs: string[];
}) {
  const t = useTranslations("home");
  const isLoggedIn = Boolean(userName);

  return (
    <div>
      <section className="auth-bg-glow border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {isLoggedIn ? t("heroWelcomeBack", { name: userName!.split(" ")[0] }) : t("heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted sm:text-lg">
            {isLoggedIn ? t("heroSubtitleLoggedIn") : t("heroSubtitle")}
          </p>
          <div className="mt-8 flex justify-center">
            {isLoggedIn ? (
              <a href="#services" className="brand-pill-btn px-7 py-3 text-sm transition hover:scale-[1.03]">
                {t("browseTools")}
              </a>
            ) : (
              <Link href="/signup" className="brand-pill-btn px-7 py-3 text-sm transition hover:scale-[1.03]">
                {t("getStarted")}
              </Link>
            )}
          </div>

          <HeroFeatureCarousel
            prevLabel={t("carouselPrev")}
            nextLabel={t("carouselNext")}
            slides={[
              {
                icon: <FcBriefcase className="h-7 w-7" />,
                badge: t("carouselJobsBadge"),
                title: t("carouselJobsTitle"),
                description: t("carouselJobsDescription"),
                ctaLabel: t("carouselJobsCta"),
                ctaHref: "/jobs",
              },
            ]}
          />
        </div>
      </section>

      {recentSlugs.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
          <div className="mb-6">
            <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
              {t("recentHeading")}
            </h2>
            <p className="mt-1 text-sm text-muted">{t("recentSubheading")}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {recentSlugs.map((slug) => (
              <ToolCard key={slug} slug={slug} showDescription={false} />
            ))}
          </div>
        </section>
      )}

      <div id="services">
        {content.categories.map((category) => (
          <CategorySection key={category.slug} category={category} />
        ))}
      </div>

      <AboutSection />
      <WhyChooseSection />
      <FAQ items={content.faqs} />
    </div>
  );
}
