import { Link } from "@/i18n/navigation";
import ServiceBadge from "./ServiceBadge";

interface ServiceCardProps {
  title: string;
  badge: "NEW" | "HOT" | null;
  href: string | null;
  icon: React.ReactNode;
}

export default function ServiceCard({ title, badge, href, icon }: ServiceCardProps) {
  const content = (
    <>
      <ServiceBadge badge={badge} />
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-soft transition-transform duration-200 group-hover:scale-110">
        {icon}
      </span>
      <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="brand-card group relative flex flex-col items-start gap-3 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-brand-light hover:shadow-[0_12px_24px_-12px_var(--color-brand)]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      title="Coming soon"
      className="brand-card relative flex cursor-default flex-col items-start gap-3 p-4 opacity-70"
    >
      {content}
    </div>
  );
}
