"use client";

import { useOrganization } from "@/components/organization-provider";
import { PlanUsageStats } from "@/components/plan-usage-stats";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Switch } from "@v1/ui/switch";
import { useAction, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";

type BillingInterval = "month" | "year";
type PaidTier = "pro" | "enterprise";

function getPlanProduct(
  products:
    | Array<{
        id: string;
        name: string;
        description: string | null;
        recurringInterval?: "month" | "year" | null;
        prices: Array<{
          priceAmount?: number;
        }>;
      }>
    | undefined,
  tier: PaidTier,
  interval: BillingInterval,
) {
  return products?.find((product) => {
    const normalizedName = product.name.trim().toLowerCase();
    return (
      normalizedName.includes(tier) && product.recurringInterval === interval
    );
  });
}

function PlanCard({
  name,
  description,
  amount,
  intervalLabel,
  isCurrent,
  currentLabel,
  actionLabel,
  isDisabled,
  isLoading,
  onAction,
}: {
  name: string;
  description: string | null;
  amount: number;
  intervalLabel: string | null;
  isCurrent: boolean;
  currentLabel?: string;
  actionLabel?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  onAction?: () => void;
}) {
  return (
    <div
      className={`flex w-full flex-col gap-4 rounded-md border p-4 ${
        isCurrent ? "border-primary/60 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-primary-foreground">
              {name}
            </span>
            {Boolean(amount) && intervalLabel ? (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-sm font-medium text-primary-foreground">
                ${amount / 100} / {intervalLabel}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-normal text-primary-foreground/80">
            {description}
          </p>
        </div>
        {isCurrent ? (
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary-foreground">
            {currentLabel}
          </span>
        ) : null}
      </div>

      {actionLabel && onAction ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={onAction}
            disabled={isDisabled || isLoading}
          >
            {isLoading ? "Working..." : actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BillingSettingsContent() {
  const locale = useCurrentLocale();
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const t = useScopedI18n("billing");
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const cachedProducts = useQuery(api.subscriptions.listAllProducts);
  const organizationSubscription = useQuery(
    api.subscriptions.getOrganizationSubscription,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );
  const canManageBilling = useQuery(
    api.roles.checkPermission,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId,
          permissionName: "organization.manage_settings",
        }
      : "skip",
  );
  const createCheckoutLink = useAction(
    api.subscriptions.createOrganizationCheckoutLink,
  );
  const changeOrganizationSubscriptionPlan = useAction(
    api.subscriptions.changeOrganizationSubscriptionPlan,
  );
  const syncOrganizationSubscription = useAction(
    api.subscriptions.syncOrganizationSubscription,
  );
  const listBillingProducts = useAction(api.subscriptions.listBillingProducts);
  const createOrganizationCustomerPortalUrl = useAction(
    api.subscriptions.createOrganizationCustomerPortalUrl,
  );

  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("month");
  const [products, setProducts] = useState<
    Array<{
      id: string;
      name: string;
      description: string | null;
      recurringInterval?: "month" | "year" | null;
      prices: Array<{
        priceAmount?: number;
      }>;
    }>
  >([]);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [isManagingPortal, setIsManagingPortal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const syncedCheckoutRef = useRef(false);
  const loadedProductsRef = useRef(false);

  useEffect(() => {
    if (syncedCheckoutRef.current) {
      return;
    }

    if (getSearchParam("checkout") !== "success") {
      return;
    }

    if (!currentOrganizationId || canManageBilling !== true) {
      return;
    }

    syncedCheckoutRef.current = true;
    void syncOrganizationSubscription({
      organizationId: currentOrganizationId,
    });
  }, [
    canManageBilling,
    currentOrganizationId,
    getSearchParam,
    syncOrganizationSubscription,
  ]);

  useEffect(() => {
    if (loadedProductsRef.current) {
      return;
    }

    if (cachedProducts === undefined) {
      return;
    }

    if (cachedProducts.length > 0) {
      loadedProductsRef.current = true;
      setProducts(cachedProducts);
      return;
    }

    loadedProductsRef.current = true;
    void listBillingProducts().then((result) => {
      setProducts(result);
    });
  }, [cachedProducts, listBillingProducts]);

  if (!currentOrganizationId || !currentOrganization) {
    return null;
  }

  const monthlyLabel =
    billingInterval === "month" ? t("perMonth") : t("perYear");
  const currentProductId = organizationSubscription?.productId ?? null;
  const currentTier =
    organizationSubscription?.tier ??
    currentOrganization.subscriptionTier ??
    "free";
  const proProduct = getPlanProduct(products, "pro", billingInterval);
  const enterpriseProduct = getPlanProduct(
    products,
    "enterprise",
    billingInterval,
  );
  const paidPlans = [proProduct, enterpriseProduct].flatMap((product) =>
    product ? [product] : [],
  );

  const handleCheckout = (productId: string) => {
    startTransition(async () => {
      try {
        setPendingProductId(productId);
        const successUrl = new URL(window.location.href);
        successUrl.searchParams.set("checkout", "success");

        const checkout = await createCheckoutLink({
          organizationId: currentOrganizationId,
          productId,
          successUrl: successUrl.toString(),
        });

        window.location.assign(checkout.url);
      } finally {
        setPendingProductId(null);
      }
    });
  };

  const handlePlanChange = (productId: string) => {
    startTransition(async () => {
      try {
        setPendingProductId(productId);
        await changeOrganizationSubscriptionPlan({
          organizationId: currentOrganizationId,
          productId,
        });
      } finally {
        setPendingProductId(null);
      }
    });
  };

  const handleManageSubscription = () => {
    startTransition(async () => {
      try {
        setIsManagingPortal(true);
        const portal = await createOrganizationCustomerPortalUrl({
          organizationId: currentOrganizationId,
        });
        window.location.assign(portal.url);
      } finally {
        setIsManagingPortal(false);
      }
    });
  };

  const subscriptionDate =
    organizationSubscription?.currentPeriodEnd !== null &&
    organizationSubscription?.currentPeriodEnd !== undefined
      ? formatDate(new Date(organizationSubscription.currentPeriodEnd), locale)
      : null;

  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">
          Billing overview
        </h2>
        <p className="text-sm text-muted-foreground">
          Review your current plan, compare available tiers, and manage billing
          for your organization. For test purchases, you can use the card
          numbers listed in this{" "}
          <a
            href="https://stripe.com/docs/testing#cards"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline"
          >
            resource from Stripe
          </a>
          .
        </p>
      </div>

      <PlanUsageStats
        organizationId={currentOrganizationId}
        showUpgradeLink={false}
      />

      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-medium text-foreground">
              {t("title")}
            </h2>
            <p className="flex items-start gap-1 text-sm font-normal text-muted-foreground">
              {t("currentPlan")}{" "}
              <span className="flex h-[18px] items-center rounded-md bg-primary/10 px-1.5 text-sm font-medium text-primary-foreground">
                {organizationSubscription?.productName ??
                  (currentTier === "free" ? t("free") : currentTier)}
              </span>
              {t("plan")}.
            </p>
            {organizationSubscription && subscriptionDate ? (
              <p className="text-sm font-normal text-muted-foreground">
                {organizationSubscription.cancelAtPeriodEnd
                  ? t("expires")
                  : t("renews")}{" "}
                {t("on")} {subscriptionDate}.
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 self-end">
            <span className="text-sm text-muted-foreground">
              {t("monthly")}
            </span>
            <Switch
              id="billing-interval"
              checked={billingInterval === "year"}
              onCheckedChange={() =>
                setBillingInterval((state) =>
                  state === "month" ? "year" : "month",
                )
              }
            />
            <span className="text-sm text-muted-foreground">{t("yearly")}</span>
          </div>

          <div className="flex w-full flex-col gap-3">
            <PlanCard
              name={t("free")}
              description={t("freeDescription")}
              amount={0}
              intervalLabel={null}
              isCurrent={currentTier === "free"}
              currentLabel={t("current")}
            />

            {paidPlans.map((product) => {
              const isCurrent = currentProductId === product.id;
              const isLoading = isPending && pendingProductId === product.id;
              const actionLabel = isCurrent
                ? t("current")
                : canManageBilling !== true
                  ? undefined
                  : organizationSubscription
                    ? t("switchPlan")
                    : t("upgrade");

              return (
                <PlanCard
                  key={product.id}
                  name={product.name}
                  description={product.description}
                  amount={product.prices[0]?.priceAmount ?? 0}
                  intervalLabel={monthlyLabel}
                  isCurrent={isCurrent}
                  currentLabel={t("current")}
                  actionLabel={actionLabel}
                  isDisabled={canManageBilling !== true}
                  isLoading={isLoading}
                  onAction={() => {
                    if (organizationSubscription) {
                      handlePlanChange(product.id);
                      return;
                    }
                    handleCheckout(product.id);
                  }}
                />
              );
            })}

            {paidPlans.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Loading paid plans…
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 py-3 dark:bg-card">
          <p className="text-sm font-normal text-muted-foreground">
            {canManageBilling === false ? t("managedByOrg") : t("noChargeTest")}
          </p>
        </div>
      </div>

      {organizationSubscription ? (
        <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-2 p-6">
            <h2 className="text-xl font-medium text-foreground">
              {t("manageSubscription")}
            </h2>
            <p className="flex items-start gap-1 text-sm font-normal text-muted-foreground">
              {canManageBilling === false
                ? t("managedByOrg")
                : t("manageDescription")}
            </p>
          </div>

          <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 py-3 dark:bg-card">
            <p className="text-sm font-normal text-muted-foreground">
              {canManageBilling === false
                ? t("managedByOrg")
                : t("redirectPortal")}
            </p>

            {canManageBilling === true ? (
              <Button
                type="button"
                size="sm"
                onClick={handleManageSubscription}
                disabled={isManagingPortal || isPending}
              >
                {isManagingPortal ? "Working…" : t("manage")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function BillingSettings() {
  return (
    <Suspense fallback={null}>
      <BillingSettingsContent />
    </Suspense>
  );
}
