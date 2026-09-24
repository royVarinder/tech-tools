import { connectToDatabase } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import ServiceModel from "@/models/Service";
import FaqModel from "@/models/Faq";
import { HOME_CATEGORIES, HOME_FAQS, type ServiceBadge } from "@/lib/homeContentSeed";

export interface ServiceView {
  slug: string;
  title: string;
  badge: ServiceBadge;
  href: string | null;
  externalUrl: string | null;
}

export interface CategoryView {
  slug: string;
  title: string;
  note?: string;
  items: ServiceView[];
}

export interface FaqView {
  question: string;
  answer: string;
}

export interface HomeContent {
  categories: CategoryView[];
  faqs: FaqView[];
}

function staticFallback(): HomeContent {
  return {
    categories: HOME_CATEGORIES.map((category) => ({
      slug: category.slug,
      title: category.title,
      note: category.note,
      items: category.items.map((item) => ({
        slug: item.slug,
        title: item.title,
        badge: item.badge,
        href: item.href,
        externalUrl: null,
      })),
    })),
    faqs: HOME_FAQS.map((faq) => ({ question: faq.question, answer: faq.answer })),
  };
}

export async function getHomeContent(): Promise<HomeContent> {
  try {
    await connectToDatabase();

    const [categories, services, faqs] = await Promise.all([
      CategoryModel.find({ active: true }).sort({ order: 1 }).lean(),
      ServiceModel.find({ active: true }).sort({ order: 1 }).lean(),
      FaqModel.find({ active: true }).sort({ order: 1 }).lean(),
    ]);

    if (categories.length === 0) {
      return staticFallback();
    }

    const categoryViews: CategoryView[] = categories.map((category) => ({
      slug: category.slug,
      title: category.title,
      note: category.note,
      items: services
        .filter((service) => service.categorySlug === category.slug)
        .map((service) => ({
          slug: service.slug,
          title: service.title,
          badge: service.badge as ServiceBadge,
          href: service.href,
          externalUrl: service.externalUrl ?? null,
        })),
    }));

    const faqViews: FaqView[] =
      faqs.length > 0
        ? faqs.map((faq) => ({ question: faq.question, answer: faq.answer }))
        : staticFallback().faqs;

    return { categories: categoryViews, faqs: faqViews };
  } catch (error) {
    console.error("Mongo unavailable, using static home content fallback:", error);
    return staticFallback();
  }
}
