import Link from "next/link";
import { getAppLoginUrl } from "@/lib/app-login-url";
import { Mark } from "./mark";
import { NavLink } from "./nav-link";

const links = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export function Nav({ floating = false }: { floating?: boolean }) {
  const signInUrl = getAppLoginUrl();

  return (
    <header
      className={
        floating
          ? "absolute top-0 left-0 right-0 z-30"
          : "relative z-30 border-b border-border bg-background/80 backdrop-blur"
      }
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-6 flex items-center justify-between">
        <Mark />
        <nav
          aria-label="Main"
          className="hidden md:flex items-center gap-10 text-xs uppercase tracking-[0.22em] text-muted-foreground"
        >
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </nav>
        <div className="flex items-center gap-5 text-xs uppercase tracking-[0.22em]">
          <a
            href={signInUrl}
            className="hidden md:inline text-muted-foreground hover:text-gold"
          >
            Sign in
          </a>
          <Link
            href="/contact"
            className="border border-gold/60 px-4 py-2.5 text-gold hover:bg-gold hover:text-ink transition-colors"
          >
            Request a Tour
          </Link>
        </div>
      </div>
    </header>
  );
}
