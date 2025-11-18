"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "0",
    description: "Perfect for small collections and getting started",
    features: [
      "Up to 100 objects",
      "Basic cataloging",
      "Single user",
      "2GB storage",
      "Community support",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Professional",
    price: "29",
    description: "For growing institutions and serious collectors",
    features: [
      "Unlimited objects",
      "Advanced cataloging",
      "Up to 10 users",
      "100GB storage",
      "Priority support",
      "Loan management",
      "Public web portal",
      "Custom branding",
    ],
    cta: "Start Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Tailored solutions for large institutions",
    features: [
      "Everything in Professional",
      "Unlimited users",
      "Unlimited storage",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Training & onboarding",
      "Multi-site support",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-4 relative scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-departure text-3xl md:text-5xl mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            Start free, upgrade when you need to. No hidden fees.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${plan.popular ? "md:-mt-4" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-secondary text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}

              <div
                className={`h-full p-8 rounded-2xl border ${
                  plan.popular
                    ? "border-primary bg-accent"
                    : "border-border bg-background"
                } hover:border-muted-foreground/20 transition-all duration-300`}
              >
                {/* Plan Header */}
                <div className="mb-6">
                  <h3 className="text-2xl font-semibold mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    {plan.price !== "Custom" && (
                      <span className="text-4xl font-bold">${plan.price}</span>
                    )}
                    {plan.price === "Custom" && (
                      <span className="text-4xl font-bold">{plan.price}</span>
                    )}
                    {plan.price !== "Custom" && (
                      <span className="text-muted-foreground">/month</span>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Link
                  href={
                    plan.price === "Custom"
                      ? "/contact"
                      : process.env.NEXT_PUBLIC_APP_URL || "/"
                  }
                  className={`block w-full py-3 px-6 rounded-full text-center font-medium transition-colors ${
                    plan.popular
                      ? "bg-primary text-secondary hover:opacity-90"
                      : "bg-secondary text-primary border border-border hover:bg-accent"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center text-sm text-muted-foreground mt-12"
        >
          All plans include 14-day free trial. No credit card required.
        </motion.p>
      </div>
    </section>
  );
}
