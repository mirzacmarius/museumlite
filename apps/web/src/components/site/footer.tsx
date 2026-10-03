import Link from "next/link";
import { getWebI18n } from "@/locales/server";
import { Mark } from "./mark";

export async function SiteFooter() {
  const { t } = await getWebI18n();
  const cols = [
    {
      h: t("marketing.footer.platform"),
      links: [
        { href: "/features", label: t("common.nav.features") },
        { href: "/pricing", label: t("common.nav.pricing") },
        {
          href: "/features#collections",
          label: t("marketing.footer.collections"),
        },
        {
          href: "/features#conservation",
          label: t("marketing.footer.conservation"),
        },
      ],
    },
    {
      h: t("marketing.footer.company"),
      links: [
        { href: "/about", label: t("common.nav.about") },
        { href: "/contact", label: t("common.nav.contact") },
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-border py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Mark homeLabel={t("common.backHome")} />
          <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
            {t("marketing.footer.description")}
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.h}>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-5">
              {col.h}
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {col.links.map((i) => (
                <li key={i.label}>
                  <Link href={i.href} className="hover:text-gold">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 mt-14 pt-6 border-t border-border flex flex-col md:flex-row justify-between gap-4 text-xs text-muted-foreground uppercase tracking-[0.25em]">
        <span suppressHydrationWarning>
          © {new Date().getFullYear()} {t("marketing.footer.rights")}
        </span>
        <span>{t("marketing.footer.tagline")}</span>
      </div>
    </footer>
  );
}
