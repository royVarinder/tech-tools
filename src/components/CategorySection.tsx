import { FcServices, FcAdvertising, FcGlobe } from "react-icons/fc";
import ToolIcon from "./ToolIcon";
import ServiceCard from "./ServiceCard";
import type { CategoryView } from "@/lib/getHomeContent";

const CATEGORY_DEFAULT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "essential-services": FcServices,
  "creative-design-studio": FcAdvertising,
  "portal-service": FcGlobe,
};

function resolveIcon(categorySlug: string, href: string | null) {
  if (href?.startsWith("/tools/")) {
    const toolSlug = href.replace("/tools/", "");
    return <ToolIcon slug={toolSlug} className="h-6 w-6" />;
  }
  const DefaultIcon = CATEGORY_DEFAULT_ICON[categorySlug] ?? FcServices;
  return <DefaultIcon className="h-6 w-6" />;
}

export default function CategorySection({ category }: { category: CategoryView }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
          {category.title}
        </h2>
        {category.note && <p className="mt-1 text-sm text-muted">{category.note}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {category.items.map((item) => (
          <ServiceCard
            key={item.slug}
            title={item.title}
            badge={item.badge}
            href={item.href}
            icon={resolveIcon(category.slug, item.href)}
          />
        ))}
      </div>
    </section>
  );
}
