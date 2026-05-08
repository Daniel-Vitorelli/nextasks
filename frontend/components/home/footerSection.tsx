"use client";

import scrollToElement from "@/lib/scrollToElement";
import { useTranslations } from "next-intl";

export default function FooterSection() {
  const t = useTranslations("home.footer");

  const sections = [
    {
      title: t("about"),
      id: "about",
    },
    {
      title: t("benefits"),
      id: "benefits",
    },
    {
      title: t("features"),
      id: "features",
    },
  ];

  return (
    <footer className="border-t bg-white py-12 dark:bg-transparent mt-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-wrap justify-between gap-6">
          <span className="text-muted-foreground order-last block text-center text-sm md:order-first">
            {t("rights")}
          </span>
          <div className="order-first flex flex-wrap justify-center gap-6 text-sm md:order-last">
            {sections.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  scrollToElement(item.id);
                }}
                className="text-muted-foreground hover:text-primary block duration-150"
              >
                <span className="font-jetbrainsMono">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
