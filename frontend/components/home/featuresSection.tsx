import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CalendarCheck2,
  Repeat2,
  Target,
  ClipboardList,
  BarChart3,
  BellRing,
  Bot,
  Trophy,
  Users,
  Swords,
  Medal,
  Award,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ReactNode } from "react";
import { Marquee } from "../ui/marquee";

export default function FeaturesSection() {
  const t = useTranslations("home.features");

  const features = [
    {
      title: t("feature1.title"),
      description: t("feature1.description"),
      icon: <CalendarCheck2 className="size-6" aria-hidden />,
    },
    {
      title: t("feature2.title"),
      description: t("feature2.description"),
      icon: <Repeat2 className="size-6" aria-hidden />,
    },
    {
      title: t("feature3.title"),
      description: t("feature3.description"),
      icon: <Target className="size-6" aria-hidden />,
    },
    {
      title: t("feature4.title"),
      description: t("feature4.description"),
      icon: <ClipboardList className="size-6" aria-hidden />,
    },
    {
      title: t("feature5.title"),
      description: t("feature5.description"),
      icon: <BarChart3 className="size-6" aria-hidden />,
    },
    {
      title: t("feature6.title"),
      description: t("feature6.description"),
      icon: <BellRing className="size-6" aria-hidden />,
    },
    {
      title: t("feature7.title"),
      description: t("feature7.description"),
      icon: <Bot className="size-6" aria-hidden />,
    },
    {
      title: t("feature8.title"),
      description: t("feature8.description"),
      icon: <Trophy className="size-6" aria-hidden />,
    },
    {
      title: t("feature9.title"),
      description: t("feature9.description"),
      icon: <Users className="size-6" aria-hidden />,
    },
    {
      title: t("feature10.title"),
      description: t("feature10.description"),
      icon: <Swords className="size-6" aria-hidden />,
    },
    {
      title: t("feature11.title"),
      description: t("feature11.description"),
      icon: <Medal className="size-6" aria-hidden />,
    },
    {
      title: t("feature12.title"),
      description: t("feature12.description"),
      icon: <Award className="size-6" aria-hidden />,
    },
  ];

  const firstRow = features.slice(0, features.length / 2);
  const secondRow = features.slice(features.length / 2);

  return (
    <section className="bg-zinc-50 dark:bg-transparent" id="features">
      <div className="@container mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl font-jetbrainsMono">
            {t("title")}
          </h2>
          <p className="mt-4">{t("description")}</p>
        </div>
        <div className="@min-2xl:max-w-full mx-auto mt-8 max-w-sm overflow-hidden shadow-zinc-950/5 *:text-center md:mt-16 bg-background p-3">
          <Marquee>
            {firstRow.map((item, index) => (
              <div
                className="group shadow-zinc-950/5 bg-background p-6 border-r border-border"
                key={index}
              >
                <CardHeader className="pb-3">
                  <CardDecorator>{item.icon}</CardDecorator>

                  <h3 className="mt-6 font-medium font-jetbrainsMono">{item.title}</h3>
                </CardHeader>

                <CardContent>
                  <p className="text-sm">{item.description}</p>
                </CardContent>
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}

const CardDecorator = ({ children }: { children: ReactNode }) => (
  <div className="mask-radial-from-40% mask-radial-to-60% relative mx-auto size-36 duration-200 [--color-border:color-mix(in_oklab,var(--color-zinc-950)10%,transparent)] group-hover:[--color-border:color-mix(in_oklab,var(--color-zinc-950)20%,transparent)] dark:[--color-border:color-mix(in_oklab,var(--color-white)15%,transparent)] dark:group-hover:[--color-border:color-mix(in_oklab,var(--color-white)20%,transparent)]">
    <div
      aria-hidden
      className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-size-[24px_24px] dark:opacity-50"
    />

    <div className="bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border-l border-t">
      {children}
    </div>
  </div>
);
