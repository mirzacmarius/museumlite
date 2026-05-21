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
    <section id="faq" className="py-32 px-4 relative bg-zinc-950">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <m.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-semibold mb-6 text-white"
          >
            Frequently Asked Questions
          </m.h2>
          <p className="text-zinc-400 text-lg">
            Everything you need to know about MuseumLite.
          </p>
        </div>

        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Accordion
            collapsible
            defaultValue="item-1"
            type="single"
            className="space-y-4"
          >
            {questions.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border border-white/10 rounded-2xl bg-white/5 px-6 data-[state=open]:bg-white/10 transition-colors"
              >
                <AccordionTrigger className="py-6 text-lg font-medium text-white hover:text-neon-blue hover:no-underline transition-colors">
                  {item.title}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-zinc-400 leading-relaxed">
                  {item.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </m.div>

        <div className="mt-16 text-center">
          <p className="text-zinc-500">
            Still have questions?{" "}
            <a
              className="text-neon-blue hover:underline font-medium"
              href="mailto:support@museumlite.com"
            >
              Contact Support
            </a>
          </p>
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
      "MuseumLite is a comprehensive collection management platform designed for museums, galleries, private collectors, and artists. It helps you catalog objects, track locations, manage loans, and publish your collection online.",
  },
  {
    id: "item-2",
    title: "How does the free plan work?",
    content:
      "The free plan includes up to 100 objects, basic cataloging features, and 2GB of storage. It's perfect for small collections and getting started. You can upgrade anytime as your collection grows.",
  },
  {
    id: "item-3",
    title: "Can I import my existing collection data?",
    content:
      "Yes! MuseumLite supports importing from CSV, Excel, and common museum software formats. Our Professional and Enterprise plans include migration assistance to help you transition smoothly.",
  },
  {
    id: "item-4",
    title: "Is my data secure?",
    content:
      "Absolutely. We use bank-level encryption for all data transmission and storage. Regular backups, SOC 2 compliance, and role-based access controls ensure your collection data is always protected.",
  },
  {
    id: "item-5",
    title: "Can I customize fields for my specific collection type?",
    content:
      "Yes! MuseumLite allows you to create custom fields for any object type. Whether you collect fine art, natural history specimens, or historical artifacts, you can tailor the system to your needs.",
  },
  {
    id: "item-6",
    title: "Does it work offline?",
    content:
      "While MuseumLite is primarily cloud-based, we offer offline capabilities through our mobile apps. You can view and update object records without internet, and changes sync when you're back online.",
  },
];
