"use client";

import Link from "next/link";
import { useState } from "react";
import { getAppRegisterUrl } from "@/lib/app-login-url";
import {
  formatPlanPrice,
  getPricingPlans,
  type BillingInterval,
} from "@/lib/pricing-plans";

export function PricingPlans() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const plans = getPricingPlans(interval);
  const registerUrl = getAppRegisterUrl();

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="mb-10 flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-end">
        <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
          Start on Free — no credit card. Upgrade to Pro or Enterprise anytime
          from Settings → Billing in the app.
        </p>
        <fieldset
          className="m-0 inline-flex min-w-0 items-center gap-3 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]"
          aria-label="Billing interval"
        >
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={`transition-colors ${
              interval === "month" ? "text-gold" : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <span className="text-border" aria-hidden>
            |
          </span>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={`transition-colors ${
              interval === "year" ? "text-gold" : "text-muted-foreground"
            }`}
          >
            Yearly
          </button>
        </fieldset>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const { price, sub } = formatPlanPrice(plan.priceAmount, plan.interval);

          return (
            <div
              key={plan.tier}
              className={`relative flex flex-col border p-8 ${
                plan.featured
                  ? "border-gold bg-card shadow-gold"
                  : "border-border bg-card"
              }`}
            >
              {plan.featured ? (
                <span className="btn-marketing absolute -top-3 left-8 bg-gold text-ink text-[10px] uppercase tracking-[0.2em] px-3 py-1">
                  Popular
                </span>
              ) : null}
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-gold mb-3">
                {plan.name}
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-display text-5xl text-ivory">{price}</span>
                {sub ? (
                  <span className="text-sm text-muted-foreground">{sub}</span>
                ) : null}
              </div>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {plan.description}
              </p>
              <ul className="space-y-2 text-sm text-soft-foreground mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-gold mt-0.5">·</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={registerUrl}
                className={`btn-marketing text-center py-3.5 text-xs uppercase tracking-[0.3em] transition-colors border ${
                  plan.featured
                    ? "bg-gold text-ink border-gold hover:bg-transparent hover:text-gold"
                    : "border-border text-ivory hover:border-gold hover:text-gold"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Prefer a walkthrough first?{" "}
        <Link href="/contact" className="text-gold hover:text-ivory transition-colors">
          Request a private tour
        </Link>
      </p>
    </div>
  );
}
