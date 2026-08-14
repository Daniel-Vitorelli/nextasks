import { useTranslations } from "next-intl";

export default function AboutSection() {
  const t = useTranslations("home.about");

  return (
    <section id="about">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-6 md:grid-cols-2 md:gap-12" >
          <h2 className="text-4xl font-medium font-jetbrainsMono" >
            {t("title")}
          </h2>
          <div className="space-y-6">
            <p>
              {t("p1")}
            </p>
            <p>
              {t("p2")}
            </p>
            <p>
              {t("p3")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
