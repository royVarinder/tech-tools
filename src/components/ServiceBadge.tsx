export default function ServiceBadge({ badge }: { badge: "NEW" | "HOT" | null }) {
  if (!badge) return null;

  return (
    <span
      className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow ${
        badge === "HOT" ? "bg-danger" : "bg-brand"
      }`}
    >
      {badge}
    </span>
  );
}
