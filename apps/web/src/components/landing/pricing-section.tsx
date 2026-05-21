"use client";

import { Button } from "@v1/ui/button";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { SpotlightCard } from "../spotlight-card";

const plans = [
  {
    name: "Starter",
    price: "0",
    description: "For hobbyists and small collections",
    features: [
      "Up to 100 objects",
      "Basic cataloging",
      "Single user",
      "Community support",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "29",
    description: "For professional curators and galleries",
    features: [
      "Unlimited objects",
      "Advanced metadata",
      "Up to 5 users",
      "Public portal",
      "Priority support",
      "API access",
    ],
    cta: "Start Trial",
    popular: true,
  },
  {
    name: "Institution",
    price: "Custom",
    description: "For large museums and organizations",
    features: [
      "Unlimited everything",
      "Custom integrations",
      "SSO & Audit logs",
      "Dedicated success manager",
      "SLA guarantee",
      "On-premise option",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="py-32 px-4 relative bg-gray-950 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-6 text-white"
          >
            Simple Pricing
          </motion.h2>
          <p className="text-zinc-400 text-lg">
            Choose the plan that fits your collection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-neon-blue text-black text-xs font-bold rounded-full z-20 shadow-[0_0_20px_rgba(0,243,255,0.5)]">
                  MOST POPULAR
                </div>
              )}

              <SpotlightCard
                className={`h-full p-8 flex flex-col transition-all duration-300
                ${
                  plan.popular
                    ? "bg-white/10 border-neon-blue/50 shadow-[0_0_30px_rgba(0,243,255,0.1)]"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
                spotlightColor={
                  plan.popular ? "rgba(0, 243, 255, 0.3)" : undefined
                }
              >
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    {plan.price !== "Custom" && (
                      <span className="text-4xl font-bold text-white">$</span>
                    )}
                    <span className="text-5xl font-bold text-white">
                      {plan.price}
                    </span>
                    {plan.price !== "Custom" && (
                      <span className="text-zinc-400">/mo</span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-zinc-300"
                    >
                      <div
                        className={`mt-1 size-5 rounded-full flex items-center justify-center ${plan.popular ? "bg-neon-blue/20 text-neon-blue" : "bg-white/10 text-white"}`}
                      >
                        <Check className="size-3" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.price === "Custom" ? "/contact" : "/register"}
                  className="w-full"
                >
                  <Button
                    className={`w-full h-12 rounded-full font-semibold text-base transition-all
                      ${
                        plan.popular
                          ? "bg-neon-blue text-black hover:bg-neon-blue/90 hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]"
                          : "bg-white text-black hover:bg-zinc-200"
                      }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
