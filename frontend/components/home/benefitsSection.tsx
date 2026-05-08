import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from 'next-intl';

export default function BenefitsSection() {
  const t = useTranslations("home.benefits");

    return (
        <section id='benefits'>
            <div className="mx-auto max-w-6xl space-y-8 px-6 md:space-y-16">
                <div className="relative z-10 mx-auto max-w-xl space-y-6 text-center md:space-y-12">
                    <h2 className="text-4xl font-medium lg:text-5xl font-jetbrainsMono">
                      {t("title")}
                    </h2>
                    <p>
                      {t("subTitle")}
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-rows-2">
                    <Card>
                        <CardContent className="h-full">
                                <p>
                                  {t("benefits1")}
                                </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="h-full">
                                <p className='font-jetbrainsMono'>
                                  {t("benefits2")}
                                </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="h-full">
                                <p className='font-jetbrainsMono'>
                                  {t("benefits3")}
                                </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="h-full">
                                <p className='font-jetbrainsMono'>
                                  {t("benefits4")}
                                </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="h-full">
                                <p className='font-jetbrainsMono'>
                                  {t("benefits5")}
                                </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="h-full">
                                <p className='font-jetbrainsMono'>
                                  {t("benefits6")}
                                </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="h-full">
                                <p className='font-jetbrainsMono'>
                                  {t("benefits7")}
                                </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="h-full">
                                <p className='font-jetbrainsMono'>
                                  {t("benefits8")}
                                </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    )
}