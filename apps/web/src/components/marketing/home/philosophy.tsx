import { Reveal } from "@/components/site/reveal";
import { SectionLabel } from "@/components/site/section-label";
import { getWebI18n } from "@/locales/server";

export async function HomePhilosophy() {
  const { t } = await getWebI18n();
  return (
    <section className="relative py-32 md:py-44">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-12">
        <Reveal className="md:col-span-5">
          <SectionLabel index="I." title={t("marketing.home.philosophyAlt")} />
          <h2 className="mt-8 font-display text-5xl md:text-7xl leading-[0.95] text-ivory text-balance">
            {t("marketing.home.philosophyTitleStart")}
            <br />
            <span className="whitespace-nowrap">
              {t("marketing.home.philosophyTitleMiddle")}{" "}
              <em className="not-italic text-gold">
                {t("marketing.home.philosophyTitleEmphasis")}
              </em>
            </span>
            <br />
            {t("marketing.home.philosophyTitleEnd")}
          </h2>
        </Reveal>
        <Reveal
          className="md:col-span-6 md:col-start-7 space-y-6 text-soft-foreground text-lg leading-relaxed"
          delay={120}
        >
          <p>{t("marketing.home.philosophyBody1")}</p>
          <p>{t("marketing.home.philosophyBody2")}</p>
          <p>{t("marketing.home.philosophyBody3")}</p>
          <p className="font-display text-xl text-gold/90 pt-4 border-t border-border leading-snug">
            {t("marketing.home.philosophyBody4")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
