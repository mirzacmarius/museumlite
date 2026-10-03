import Link from "next/link";
import "@/marketing-styles.css";
import { MarketingFonts } from "@/components/site/marketing-fonts";
import { MarketingSiteRoot } from "@/components/site/marketing-site-root";
import { MarketingSiteShell } from "@/components/site/marketing-site-shell";
import { MarketingThemeScript } from "@/components/site/marketing-theme";
import { getWebI18n } from "@/locales/server";

export default async function NotFound() {
  const { t } = await getWebI18n();
  return (
    <MarketingFonts>
      <MarketingThemeScript />
      <MarketingSiteRoot>
        <MarketingSiteShell>
          <main
            id="main-content"
            className="flex min-h-screen items-center justify-center px-6 bg-background"
          >
            <div className="max-w-md text-center">
              <p className="text-[10px] uppercase tracking-[0.4em] text-gold mb-4">
                404
              </p>
              <h1 className="font-display text-6xl text-ivory">
                {t("common.pageNotFound")}
              </h1>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {t("common.pageNotFoundDescription")}
              </p>
              <Link
                href="/"
                className="btn-marketing mt-8 inline-flex border border-gold bg-gold px-6 py-3 text-xs uppercase tracking-[0.3em] text-ink hover:bg-transparent hover:text-gold transition-colors"
              >
                {t("common.backHome")}
              </Link>
            </div>
          </main>
        </MarketingSiteShell>
      </MarketingSiteRoot>
    </MarketingFonts>
  );
}
