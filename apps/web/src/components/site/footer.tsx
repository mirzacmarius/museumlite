import Link from "next/link";
import { Mark } from "./mark";

export function SiteFooter() {
  const cols = [
    {
      h: "Platform",
      links: [
        { href: "/features", label: "Features" },
        { href: "/pricing", label: "Pricing" },
        { href: "/features#collections", label: "Collections" },
        { href: "/features#conservation", label: "Conservation" },
      ],
    },
    {
      h: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/contact", label: "Contact" },
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-border py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Mark />
          <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
            Museum collection management — catalogue objects, plan exhibitions,
            track conservation, and publish a public portal from one workspace.
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
          © {new Date().getFullYear()} MuseumLite. All rights reserved.
        </span>
        <span>Made with care for the keepers of culture.</span>
      </div>
    </footer>
  );
}
