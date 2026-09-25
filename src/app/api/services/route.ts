import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Service from "@/models/Service";
import { HOME_CATEGORIES } from "@/lib/homeContentSeed";

export interface SearchableService {
  slug: string;
  title: string;
  href: string | null;
  externalUrl: string | null;
}

function staticFallback(): SearchableService[] {
  return HOME_CATEGORIES.flatMap((category) =>
    category.items
      .filter((item) => item.href)
      .map((item) => ({ slug: item.slug, title: item.title, href: item.href ?? null, externalUrl: null }))
  );
}

export async function GET() {
  try {
    await connectToDatabase();
    const services = await Service.find({ active: true }).sort({ order: 1 }).lean();

    const enabled = services.filter((s) => s.href || s.externalUrl);
    if (enabled.length > 0) {
      return NextResponse.json(
        enabled.map((s) => ({
          slug: s.slug,
          title: s.title,
          href: s.href ?? null,
          externalUrl: s.externalUrl ?? null,
        }))
      );
    }
  } catch (error) {
    console.error("Falling back to static service registry:", error);
  }

  return NextResponse.json(staticFallback());
}
