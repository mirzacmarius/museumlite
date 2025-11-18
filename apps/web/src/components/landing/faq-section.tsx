"use client";

import { motion } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v1/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "What is MuseumLite?",
    answer:
      "MuseumLite is a comprehensive collection management platform designed for museums, galleries, private collectors, and artists. It helps you catalog objects, track locations, manage loans, and publish your collection online.",
  },
  {
    question: "How does the free plan work?",
    answer:
      "The free plan includes up to 100 objects, basic cataloging features, and 2GB of storage. It's perfect for small collections and getting started. You can upgrade anytime as your collection grows.",
  },
  {
    question: "Can I import my existing collection data?",
    answer:
      "Yes! MuseumLite supports importing from CSV, Excel, and common museum software formats. Our Professional and Enterprise plans include migration assistance.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Absolutely. We use bank-level encryption for all data transmission and storage. Regular backups, SOC 2 compliance, and role-based access controls ensure your collection data is always protected.",
  },
  {
    question: "Can I customize fields for my specific collection type?",
    answer:
      "Yes! MuseumLite allows you to create custom fields for any object type. Whether you collect fine art, natural history specimens, or historical artifacts, you can tailor the system to your needs.",
  },
  {
    question: "Does it work offline?",
    answer:
      "While MuseumLite is primarily cloud-based, we offer offline capabilities through our mobile apps. You can view and update object records without internet, and changes sync when you're back online.",
  },
];

function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between py-5 border-b border-border hover:text-foreground transition-colors text-left">
          <span className="font-medium text-lg pr-4">{question}</span>
          <ChevronDown
            className={`h-5 w-5 flex-shrink-0 transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="py-4 text-muted-foreground leading-relaxed">
          {answer}
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="py-24 px-4 relative bg-accent/30 scroll-mt-20">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-departure text-3xl md:text-5xl mb-4">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground md:text-lg">
            Everything you need to know about MuseumLite
          </p>
        </motion.div>

        {/* FAQ List */}
        <div className="space-y-0">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              index={index}
            />
          ))}
        </div>

        {/* Contact Support */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Still have questions? We're here to help.
          </p>
          <a
            href="mailto:support@museumlite.com"
            className="text-primary hover:underline font-medium"
          >
            Contact Support →
          </a>
        </motion.div>
      </div>
    </section>
  );
}
