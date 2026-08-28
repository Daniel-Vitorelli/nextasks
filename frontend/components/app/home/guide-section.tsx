"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Compass, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Ordem do tour — imagens geradas em public/guide/*.png. */
const SLIDES = [
  "home",
  "dashboard",
  "calendar",
  "gamification",
  "social",
  "ai",
  "config",
] as const;

type SlideKey = (typeof SLIDES)[number];

interface GuideSectionProps {
  /** Se deve começar recolhido (para usuários com dados) */
  defaultCollapsed?: boolean;
}

/**
 * Guia interativo da home: carrossel de screenshots das telas com legenda,
 * navegação por botões/dots/swipe e teclado (setas quando focado).
 * Pode começar recolhido e ser expandido pelo usuário.
 */
export function GuideSection({ defaultCollapsed = false }: GuideSectionProps) {
  const t = useTranslations("app.home.guide");
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const scrollTo = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, index));
      emblaApi.scrollTo(clamped);
    },
    [emblaApi],
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollTo(selectedIndex + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollTo(selectedIndex - 1);
      }
    },
    [scrollTo, selectedIndex],
  );

  return (
    <section className="space-y-3">
      {!isCollapsed ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-0.5">
              <p className="font-jetbrainsMono text-muted-foreground text-xs uppercase tracking-[0.2em]">
                {t("eyebrow")}
              </p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {t("title")}
              </h2>
              <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t("prev")}
                disabled={selectedIndex === 0}
                onClick={() => scrollTo(selectedIndex - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="font-jetbrainsMono text-muted-foreground w-12 text-center text-xs tabular-nums">
                {selectedIndex + 1} / {SLIDES.length}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t("next")}
                disabled={selectedIndex === SLIDES.length - 1}
                onClick={() => scrollTo(selectedIndex + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div
            ref={emblaRef}
            tabIndex={0}
            role="region"
            aria-label={t("title")}
            onKeyDown={onKeyDown}
            className="overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex touch-pan-y">
              {SLIDES.map((key) => (
                <div key={key} className="min-w-0 flex-[0_0_100%] px-0.5">
                  <figure className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- screenshots estáticos já otimizados */}
                    <img
                      src={`/guide/${key}.png`}
                      alt={t(`slides.${key}.title`)}
                      loading="lazy"
                      draggable={false}
                      className="aspect-[16/10] w-full select-none object-cover object-top"
                    />
                    <figcaption className="flex items-start gap-3 p-4">
                      <span className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <Compass className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {t(`slides.${key}.title`)}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                          {t(`slides.${key}.description`)}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                </div>
              ))}
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5">
            {SLIDES.map((key, index) => (
              <button
                key={key}
                type="button"
                aria-label={t(`slides.${key}.title`)}
                aria-current={index === selectedIndex}
                onClick={() => scrollTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === selectedIndex
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5",
                )}
              />
            ))}
          </div>
        </>
      ) : (
        // Estado recolhido: apenas um botão para expandir
        <div className="rounded-xl border border-border/60 bg-card/50 p-4">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-2 w-full text-left p-2 hover:bg-muted/50 rounded-lg transition-colors"
          >
            <Compass className="size-5 text-muted-foreground" />
            <span className="min-w-0 text-sm font-medium text-muted-foreground">
              {t("title")}
            </span>
            <ChevronDown className="size-5 text-muted-foreground" />
          </button>
        </div>
      )}
    </section>
  );
}
