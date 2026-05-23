import Link from "next/link";
import { Mark } from "./mark";

export function SiteFooter() {
  const cols = [
    {
      h: "Platform",
      links: [
        { href: "/features", label: "Features" },
        { href: "/pricing", label: "Pricing" },
        { href: "/features", label: "Collections" },
        { href: "/features", label: "Conservation" },
      ],
    },
    {
      h: "Institution",
      links: [
        { href: "/about", label: "About" },
        { href: "/contact", label: "Contact" },
        { href: "/about", label: "Journal" },
        { href: "/about", label: "Press" },
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-border py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Mark />
          <p className="mt-4 text-sm text-ivory/55 max-w-xs leading-relaxed">
            MuseumLite — built in Florence & Edinburgh for the institutions
            that keep memory alive.
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.h}>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-5">
              {col.h}
            </div>
            <ul className="space-y-3 text-sm text-ivory/65">
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
      <div className="mx-auto max-w-7xl px-6 lg:px-10 mt-14 pt-6 border-t border-border flex flex-col md:flex-row justify-between gap-4 text-xs text-ivory/40 uppercase tracking-[0.25em]">
        <span>© MMXXV MuseumLite. All rights reserved.</span>
        <span>Made with care for the keepers of culture.</span>
      </div>
    </footer>
  );
}
