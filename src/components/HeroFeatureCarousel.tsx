"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

export interface HeroCarouselSlide {
  icon: React.ReactNode;
  badge?: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

const AUTO_ADVANCE_MS = 5000;

export default function HeroFeatureCarousel({
  slides,
  prevLabel,
  nextLabel,
}: {
  slides: HeroCarouselSlide[];
  prevLabel: string;
  nextLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  if (slides.length === 0) return null;

  return (
    <div
      className="brand-card relative mx-auto mt-10 max-w-3xl overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div key={i} className="flex w-full shrink-0 flex-col items-center gap-3 px-6 py-8 text-center sm:flex-row sm:gap-6 sm:px-10 sm:text-left">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-soft text-3xl">
              {slide.icon}
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {slide.badge && (
                  <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-bright">
                    {slide.badge}
                  </span>
                )}
                <h2 className="font-heading text-lg font-bold text-foreground">{slide.title}</h2>
              </div>
              <p className="mt-1 text-sm text-muted">{slide.description}</p>
            </div>
            <Link
              href={slide.ctaHref}
              className="brand-pill-btn shrink-0 px-5 py-2.5 text-sm transition hover:scale-[1.03]"
            >
              {slide.ctaLabel}
            </Link>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label={prevLabel}
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:bg-surface-soft sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:bg-surface-soft sm:flex"
          >
            ›
          </button>
          <div className="flex justify-center gap-1.5 pb-4">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-brand-bright" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
