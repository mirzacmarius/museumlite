"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@v1/ui/accordion";

export function FaqsSectionEfferd() {
  return (
    <div id="faq" className="mx-auto min-h-screen w-full max-w-5xl lg:border-x scroll-mt-20">
      <div className="mx-4 grid h-[calc(100vh-3.5rem)] grid-cols-1 border-x md:mx-0 md:grid-cols-2 md:border-x-0">
        <div className="space-y-4 px-4 pt-12 pb-4 md:border-r">
          <h2 className="font-black text-3xl md:text-4xl">FAQs</h2>
          <p className="text-muted-foreground">
            Everything you need to know about MuseumLite. Find answers to common
            questions about our collection management platform.
          </p>
        </div>
        <div className="place-content-center">
          <Accordion collapsible defaultValue="item-1" type="single">
            {questions.map((item) => (
              <AccordionItem
                className="first:border-t last:border-b data-[state=open]:bg-card"
                key={item.id}
                value={item.id}
              >
                <AccordionTrigger className="px-4 py-4 text-[15px] leading-6 hover:no-underline">
                  {item.title}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 text-muted-foreground">
                  {item.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
      <div className="flex h-14 items-center justify-center border-t">
        <p className="text-muted-foreground">
          Can't find what you're looking for?{" "}
          <a
            className="text-primary hover:underline"
            href="mailto:support@museumlite.com"
          >
            Contact Us
          </a>
        </p>
      </div>
    </div>
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
