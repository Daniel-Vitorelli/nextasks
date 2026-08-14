import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function CallToActionSection() {
    const t = useTranslations("home.callToAction")

    return (
        <section>
            <div className="mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <h2 className="text-balance text-4xl font-semibold lg:text-5xl font-jetbrainsMono">{t("title")}</h2>
                    <p className="mt-4">{t("description")}</p>

                    <div className="mt-12 flex flex-wrap justify-center gap-4">
                        <Button
                            asChild
                            size="lg">
                            <Link href="sign-up">
                                <span className='font-jetbrainsMono'>{t("getStarted")}</span>
                            </Link>
                        </Button>

                        <Button
                            asChild
                            size="lg"
                            variant="outline">
                            <Link href="login">
                                <span className='font-jetbrainsMono'>{t("login")}</span>
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}