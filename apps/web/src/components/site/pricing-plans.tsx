"use client";

import Link from "next/link";
import { useState } from "react";
import { getAppRegisterUrl } from "@/lib/app-login-url";
import {
  type BillingInterval,
  formatPlanPrice,
  getPricingPlans,
} from "@/lib/pricing-plans";
import { useWebI18n } from "@/locales/provider";

export function PricingPlans() {
  const { locale, t } = useWebI18n();
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("month");
  const plans = getPricingPlans(billingInterval, t);
  const registerUrl = getAppRegisterUrl(locale);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="mb-10 flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-end">
        <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
          {t("marketing.pricing.startFreeNote")}
        </p>
        <fieldset
          className="m-0 inline-flex min-w-0 items-center gap-3 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]"
          aria-label={t("marketing.pricing.billingInterval")}
        >
          <button
            type="button"
            onClick={() => setBillingInterval("month")}
            className={`transition-colors ${
              billingInterval === "month"
                ? "text-gold"
                : "text-muted-foreground"
            }`}
          >
            {t("marketing.pricing.monthly")}
          </button>
          <span className="text-border" aria-hidden>
            |
          </span>
          <button
            type="button"
            onClick={() => setBillingInterval("year")}
            className={`transition-colors ${
              billingInterval === "year" ? "text-gold" : "text-muted-foreground"
            }`}
          >
            {t("marketing.pricing.yearly")}
          </button>
        </fieldset>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const { price } = formatPlanPrice(plan.priceAmount);
          const sub = plan.interval
            ? t(
                plan.interval === "year"
                  ? "marketing.pricing.perYear"
                  : "marketing.pricing.perMonth",
              )
            : "";

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
                  {t("marketing.pricing.popular")}
                </span>
              ) : null}
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-gold mb-3">
                {plan.name}
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-display text-5xl text-ivory">
                  {price}
                </span>
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
        {t("marketing.pricing.walkthroughPrompt")}{" "}
        <Link
          href="/contact"
          className="text-gold hover:text-ivory transition-colors"
        >
          {t("marketing.pricing.privateTour")}
        </Link>
      </p>
    </div>
  );
}
