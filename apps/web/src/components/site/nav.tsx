import { getAppLoginUrl } from "@/lib/app-login-url";
import { getWebI18n } from "@/locales/server";
import { LocaleSwitcher } from "./locale-switcher";
import { Mark } from "./mark";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";
import { ThemeSwitcher } from "./theme-switcher";

export async function Nav({ floating = false }: { floating?: boolean }) {
  const { locale, t } = await getWebI18n();
  const signInUrl = getAppLoginUrl(locale);
  const links = [
    { href: "/features", label: t("common.nav.features") },
    { href: "/pricing", label: t("common.nav.pricing") },
    { href: "/about", label: t("common.nav.about") },
    { href: "/contact", label: t("common.nav.contact") },
  ];

  return (
    <header
      className={
        floating
          ? "absolute top-0 left-0 right-0 z-30"
          : "relative z-30 border-b border-border bg-background/80 backdrop-blur"
      }
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex items-center justify-between gap-4">
        <Mark homeLabel={t("common.backHome")} />
        <nav
          aria-label={t("common.nav.main")}
          className="hidden lg:flex items-center gap-10 text-xs uppercase tracking-[0.22em] text-muted-foreground"
        >
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </nav>
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.22em]">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeSwitcher className="hidden sm:inline-flex" />
          <a
            href={signInUrl}
            className="hidden lg:inline text-muted-foreground hover:text-gold"
          >
            {t("common.nav.signIn")}
          </a>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
