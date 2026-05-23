import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader } from "@/components/site/section-label";

export const metadata: Metadata = {
  title: "Pricing — MuseumLite",
  description:
    "Three considered plans for small collections, regional museums and national institutions. Transparent pricing.",
  openGraph: {
    title: "Pricing — MuseumLite",
    description: "Considered, never complicated.",
  },
};

const tiers = [
  {
    name: "Atelier",
    price: "€280",
    sub: "/ month",
    desc: "For small museums and private collections.",
    features: [
      "Up to 5,000 objects",
      "5 staff seats",
      "Object Catalog & Accessions",
      "Public portal (subdomain)",
      "Email support",
    ],
    cta: "Begin",
  },
  {
    name: "Gallery",
    price: "€890",
    sub: "/ month",
    desc: "For regional museums with active programming.",
    features: [
      "Unlimited objects",
      "20 staff seats",
      "Exhibitions & Loans modules",
      "Conservation suite",
      "Custom domain portal",
      "Priority support",
    ],
    cta: "Begin",
    featured: true,
  },
  {
    name: "Institution",
    price: "Bespoke",
    sub: "",
    desc: "For national institutions and consortia.",
    features: [
      "Dedicated infrastructure",
      "Unlimited seats",
      "Full module suite + Library",
      "SSO & audit logging",
      "ISO 27001 compliance",
      "Named success engineer",
    ],
    cta: "Speak with us",
  },
];

const faqs = [
  [
    "Is data migration included?",
    "Yes. Our migrations team imports your existing records from CollectionSpace, TMS, EmbARK, Past Perfect, Axiell or spreadsheets — at no additional cost on Gallery and Institution tiers.",
  ],
  [
    "Where is data hosted?",
    "EU (Frankfurt) by default. UK (London), US (Virginia) and AU (Sydney) regions are available for Institution plans, with data residency guarantees.",
  ],
  [
    "Do you offer non-profit pricing?",
    "We discount Atelier and Gallery by 25% for accredited non-profits and reduce setup fees to zero. Just mention it when you request a tour.",
  ],
  [
    "Can we self-host?",
    "Institution tier supports private deployment on your own infrastructure with annual licensing. Talk to us about requirements.",
  ],
];

export default function PricingPage() {
  return (
    <main className="bg-background text-foreground">
      <Nav />
      <PageHeader
        eyebrow="Stewardship Plans"
        title={
          <>
            Considered,
            <br />
            <em className="not-italic text-gold">never complicated.</em>
          </>
        }
        lede="Three plans, transparent pricing, no per-object fees. Free 30-day trial on Atelier and Gallery."
      />

      <section className="bg-border py-24">
        <div className="mx-auto grid max-w-7xl gap-px px-6 md:grid-cols-3 lg:px-10">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative p-10 flex flex-col ${t.featured ? "bg-card" : "bg-background"}`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-10 bg-gold text-ink text-[10px] uppercase tracking-[0.3em] px-3 py-1">
                  Most chosen
                </span>
              )}
              <div className="text-xs uppercase tracking-[0.3em] text-gold mb-4">
                {t.name}
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-display text-6xl text-ivory">
                  {t.price}
                </span>
                <span className="text-muted-foreground text-sm">{t.sub}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-8">{t.desc}</p>
              <ul className="space-y-3 text-sm text-soft-foreground mb-10">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 border-b border-border/60 pb-2"
                  >
                    <span className="text-gold mt-0.5">✦</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/contact"
                className={`mt-auto text-center py-4 text-xs uppercase tracking-[0.3em] transition-colors border ${
                  t.featured
                    ? "bg-gold text-ink border-gold hover:bg-transparent hover:text-gold"
                    : "border-ivory/30 text-ivory hover:border-gold hover:text-gold"
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 border-t border-border">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          <h2 className="font-display text-5xl text-ivory mb-12 text-center">
            Quietly answered.
          </h2>
          <div className="divide-y divide-border border-y border-border">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-6">
                <summary className="cursor-pointer list-none flex justify-between items-center text-ivory hover:text-gold transition-colors">
                  <span className="font-display text-2xl">{q}</span>
                  <span className="text-gold text-2xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
