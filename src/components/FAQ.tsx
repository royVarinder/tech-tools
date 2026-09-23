"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FcUp, FcDown } from "react-icons/fc";
import type { FaqView } from "@/lib/getHomeContent";

export default function FAQ({ items }: { items: FaqView[] }) {
  const tHome = useTranslations("home");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="mb-8 text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
        {tHome("faqHeading")}
      </h2>
      <div className="space-y-3">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="brand-card overflow-hidden transition-colors hover:border-brand-light"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-foreground sm:text-base"
              >
                {item.question}
                <span className="shrink-0 transition-transform duration-300">
                  {isOpen ? <FcUp className="h-5 w-5" /> : <FcDown className="h-5 w-5" />}
                </span>
              </button>
              <div className={`accordion-row ${isOpen ? "is-open" : ""}`}>
                <div>
                  <div className="px-5 pb-4 text-sm text-muted">{item.answer}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
