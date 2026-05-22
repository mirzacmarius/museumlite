"use client";

import { Button } from "@v1/ui/button";
import { m } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "0",
    period: "/mo",
    description: "For hobbyists and small collections",
    features: [
      "Up to 100 objects",
      "Basic cataloging",
      "Single user",
      "2 GB storage",
      "Community support",
    ],
    cta: "Start free",
    href: "https://app.museumlite.com/register",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "29",
    period: "/mo",
    description: "For professional curators and galleries",
    features: [
      "Unlimited objects",
      "Advanced metadata & custom fields",
      "Up to 5 team members",
      "Public portal",
      "Priority support",
      "API access",
    ],
    cta: "Start trial",
    href: "https://app.museumlite.com/register",
    highlighted: true,
  },
  {
    name: "Institution",
    price: "Custom",
    period: "",
    description: "For museums and large organizations",
    features: [
      "Unlimited everything",
      "Custom integrations",
      "SSO & audit logs",
      "Dedicated success manager",
      "SLA guarantee",
      "On-premise option",
    ],
    cta: "Contact sales",
    href: "/contact",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="py-28 md:py-36 px-6 md:px-12 relative bg-zinc-950"
    >
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-20">
          <m.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-accent text-sm font-medium tracking-wide uppercase mb-4"
          >
            Pricing
          </m.p>
          <m.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-3xl md:text-5xl font-semibold tracking-tighter text-white mb-5"
          >
            Straightforward pricing
          </m.h2>
          <m.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-base md:text-lg"
          >
            Start free, scale as your collection grows.
          </m.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06] max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <m.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`bg-zinc-950 p-8 md:p-10 flex flex-col ${
                plan.highlighted ? "bg-zinc-900/40" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-white">
                  {plan.name}
                </h3>
                {plan.highlighted && (
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                    Popular
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                {plan.price !== "Custom" && (
                  <span className="text-sm font-medium text-zinc-500">$</span>
                )}
                <span className="text-4xl font-semibold text-white tracking-tight font-mono">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                )}
              </div>
              <p className="text-sm text-zinc-500 mb-8">{plan.description}</p>

              <ul className="space-y-3 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 size-4 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                      <Check className="size-2.5 text-zinc-400" />
                    </div>
                    <span className="text-zinc-400">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={plan.href} className="w-full">
                <Button
                  className={`w-full h-11 rounded-lg font-medium text-sm transition-all active:scale-[0.98] ${
                    plan.highlighted
                      ? "bg-white text-zinc-950 hover:bg-zinc-200"
                      : "bg-white/[0.06] text-white hover:bg-white/10 border border-white/[0.06]"
                  }`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
