"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@v1/ui/accordion";
import { m } from "framer-motion";

export function FaqsSectionEfferd() {
  return (
    <section
      id="faq"
      className="py-28 md:py-36 px-6 md:px-12 relative bg-zinc-950"
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
          <div className="max-w-md">
            <m.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-accent text-sm font-medium tracking-wide uppercase mb-4"
            >
              FAQ
            </m.p>
            <m.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="text-3xl md:text-5xl font-semibold tracking-tighter text-white mb-5"
            >
              Common questions
            </m.h2>
            <m.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-zinc-400 text-base leading-relaxed mb-8"
            >
              Everything you need to know about MuseumLite. Can&apos;t find what
              you&apos;re looking for?
            </m.p>
            <m.a
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              href="mailto:support@museumlite.com"
              className="text-sm text-accent hover:underline font-medium"
            >
              Reach out to our team
            </m.a>
          </div>

          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <Accordion
              collapsible
              defaultValue="item-1"
              type="single"
              className="space-y-2"
            >
              {questions.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border border-white/[0.06] rounded-xl bg-white/[0.02] px-5 data-[state=open]:bg-white/[0.04] transition-colors"
                >
                  <AccordionTrigger className="py-5 text-sm font-medium text-white hover:text-accent hover:no-underline transition-colors">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm text-zinc-400 leading-relaxed">
                    {item.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </m.div>
        </div>
      </div>
    </section>
  );
}

const questions = [
  {
    id: "item-1",
    title: "What is MuseumLite?",
    content:
      "MuseumLite is a collection management platform for museums, galleries, private collectors, and artists. Catalog objects, track locations, manage loans, and publish your collection online.",
  },
  {
    id: "item-2",
    title: "How does the free plan work?",
    content:
      "The free plan includes up to 100 objects, basic cataloging, and 2 GB of storage. No credit card required. Upgrade anytime as your collection grows.",
  },
  {
    id: "item-3",
    title: "Can I import existing collection data?",
    content:
      "Yes. MuseumLite supports CSV, Excel, and common museum software formats. Pro and Institution plans include guided migration assistance.",
  },
  {
    id: "item-4",
    title: "Is my data secure?",
    content:
      "All data is encrypted in transit and at rest. We maintain regular backups, SOC 2 compliance, and role-based access controls to keep your collection data protected.",
  },
  {
    id: "item-5",
    title: "Can I customize fields for my collection type?",
    content:
      "Yes. Create custom fields for any object type, whether you collect fine art, natural history specimens, or historical artifacts.",
  },
  {
    id: "item-6",
    title: "Does it work offline?",
    content:
      "MuseumLite is primarily cloud-based, with offline capabilities through our mobile apps. View and update records without internet, and changes sync when reconnected.",
  },
];
