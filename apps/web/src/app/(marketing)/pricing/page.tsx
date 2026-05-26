import Link from "next/link";
import { SiteFooter } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { PageHeader } from "@/components/site/section-label";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Pricing",
  description:
    "Transparent plans for small collections, regional museums, and larger institutions. Free trial on standard tiers.",
  path: "/pricing",
});

const tiers = [
  {
    name: "Atelier",
    price: "€280",
    sub: "/ month",
    desc: "For small museums and private collections getting started.",
    features: [
      "Up to 5,000 objects",
      "5 staff seats",
      "Object catalog & accessions",
      "Public portal (subdomain)",
      "Email support",
    ],
    cta: "Request a tour",
  },
  {
    name: "Gallery",
    price: "€890",
    sub: "/ month",
    desc: "For regional museums with active exhibition programmes.",
    features: [
      "Unlimited objects",
      "20 staff seats",
      "Exhibitions & loans modules",
      "Conservation suite",
      "Custom domain portal",
      "Priority support",
    ],
    cta: "Request a tour",
    featured: true,
  },
  {
    name: "Institution",
    price: "Custom",
    sub: "",
    desc: "For national institutions and consortia with specific requirements.",
    features: [
      "Dedicated infrastructure options",
      "Unlimited seats",
      "Full module suite + library",
      "SSO & audit logging",
      "Named success contact",
    ],
    cta: "Speak with us",
  },
];

const faqs = [
  [
    "Is data migration included?",
    "We help early partners import records from spreadsheets or common systems. Scope depends on your collection size — we will outline this during your tour.",
  ],
  [
    "Where is data hosted?",
    "EU (Frankfurt) by default. Additional regions can be discussed for Institution plans.",
  ],
  [
    "Do you offer non-profit pricing?",
    "We offer discounts for accredited non-profits on Atelier and Gallery. Mention it when you request a tour.",
  ],
  [
    "Can we self-host?",
    "Private deployment is available for Institution plans. Talk to us about your requirements.",
  ],
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="bg-background text-foreground">
        <PageHeader
          eyebrow="Pricing"
          title={
            <>
              Clear plans,
              <br />
              <span className="text-gold">no per-object fees.</span>
            </>
          }
          lede="Three tiers with transparent monthly pricing. We will confirm trial terms when you book a walkthrough."
        />

        <section className="py-16 md:py-24 border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-3 lg:px-10">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`relative flex flex-col border p-8 ${
                  t.featured
                    ? "border-gold bg-card shadow-gold"
                    : "border-border bg-card"
                }`}
              >
                {t.featured && (
                  <span className="btn-marketing absolute -top-3 left-8 bg-gold text-ink text-[10px] uppercase tracking-[0.2em] px-3 py-1">
                    Popular
                  </span>
                )}
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-gold mb-3">
                  {t.name}
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-display text-5xl text-ivory">{t.price}</span>
                  <span className="text-sm text-muted-foreground">{t.sub}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {t.desc}
                </p>
                <ul className="space-y-2 text-sm text-soft-foreground mb-8 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-gold mt-0.5">·</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`btn-marketing text-center py-3.5 text-xs uppercase tracking-[0.3em] transition-colors border ${
                    t.featured
                      ? "bg-gold text-ink border-gold hover:bg-transparent hover:text-gold"
                      : "border-border text-ivory hover:border-gold hover:text-gold"
                  }`}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-6 lg:px-10">
            <h2 className="font-display text-3xl text-ivory mb-10 text-center">
              Common questions
            </h2>
            <div className="divide-y divide-border border-y border-border">
              {faqs.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="cursor-pointer list-none flex justify-between items-center gap-4 text-ivory hover:text-gold transition-colors">
                    <span className="font-display text-xl">{q}</span>
                    <span className="text-gold text-xl shrink-0 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
