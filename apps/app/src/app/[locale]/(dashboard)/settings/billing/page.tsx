"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Switch } from "@v1/ui/switch";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PlanUsageStats } from "@/components/plan-usage-stats";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type BillingInterval = "month" | "year";
type PaidTier = "pro" | "enterprise";

interface BillingProduct {
  id: string;
  name: string;
  description: string | null;
  recurringInterval?: "month" | "year" | null;
  prices: Array<{
    priceAmount?: number;
  }>;
}

function getPlanProduct(
  products: BillingProduct[] | undefined,
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
            {amount && intervalLabel ? (
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

function BillingOverview() {
  return (
    <div className="flex w-full flex-col gap-2">
      <h2 className="text-xl font-medium text-foreground">Billing overview</h2>
      <p className="text-sm text-muted-foreground">
        Review your current plan, compare available tiers, and manage billing
        for your organization. For test purchases, you can use the card numbers
        listed in this{" "}
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
  );
}

function BillingIntervalToggle({
  billingInterval,
  monthlyLabel,
  onBillingIntervalChange,
  yearlyLabel,
}: {
  billingInterval: BillingInterval;
  monthlyLabel: string;
  onBillingIntervalChange: () => void;
  yearlyLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 self-end">
      <span className="text-sm text-muted-foreground">{monthlyLabel}</span>
      <Switch
        id="billing-interval"
        checked={billingInterval === "year"}
        onCheckedChange={onBillingIntervalChange}
      />
      <span className="text-sm text-muted-foreground">{yearlyLabel}</span>
    </div>
  );
}

function BillingPlansSection({
  billingInterval,
  canManageBilling,
  currentProductId,
  currentTier,
  intervalLabel,
  isPending,
  labels,
  onBillingIntervalChange,
  onCheckout,
  onPlanChange,
  organizationSubscription,
  paidPlans,
  pendingProductId,
  subscriptionDate,
}: {
  billingInterval: BillingInterval;
  canManageBilling: boolean | undefined;
  currentProductId: string | null;
  currentTier: string;
  intervalLabel: string | null;
  isPending: boolean;
  labels: {
    current: string;
    currentPlan: string;
    expires: string;
    free: string;
    freeDescription: string;
    loadingPaidPlans: string;
    managedByOrg: string;
    monthly: string;
    noChargeTest: string;
    on: string;
    perMonth: string;
    perYear: string;
    plan: string;
    renews: string;
    switchPlan: string;
    title: string;
    upgrade: string;
    yearly: string;
  };
  onBillingIntervalChange: () => void;
  onCheckout: (productId: string) => void;
  onPlanChange: (productId: string) => void;
  organizationSubscription:
    | {
        cancelAtPeriodEnd?: boolean;
        productName?: string | null;
      }
    | null
    | undefined;
  paidPlans: BillingProduct[];
  pendingProductId: string | null;
  subscriptionDate: string | null;
}) {
  return (
    <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
      <div className="flex w-full flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-foreground">
            {labels.title}
          </h2>
          <p className="flex items-start gap-1 text-sm font-normal text-muted-foreground">
            {labels.currentPlan}{" "}
            <span className="flex h-[18px] items-center rounded-md bg-primary/10 px-1.5 text-sm font-medium text-primary-foreground">
              {organizationSubscription?.productName ??
                (currentTier === "free" ? labels.free : currentTier)}
            </span>
            {labels.plan}.
          </p>
          {organizationSubscription && subscriptionDate ? (
            <p className="text-sm font-normal text-muted-foreground">
              {organizationSubscription.cancelAtPeriodEnd
                ? labels.expires
                : labels.renews}{" "}
              {labels.on} {subscriptionDate}.
            </p>
          ) : null}
        </div>

        <BillingIntervalToggle
          billingInterval={billingInterval}
          monthlyLabel={labels.monthly}
          onBillingIntervalChange={onBillingIntervalChange}
          yearlyLabel={labels.yearly}
        />

        <div className="flex w-full flex-col gap-3">
          <PlanCard
            name={labels.free}
            description={labels.freeDescription}
            amount={0}
            intervalLabel={null}
            isCurrent={currentTier === "free"}
            currentLabel={labels.current}
          />

          {paidPlans.map((product) => {
            const isCurrent = currentProductId === product.id;
            const isLoading = isPending && pendingProductId === product.id;
            const actionLabel = isCurrent
              ? labels.current
              : canManageBilling !== true
                ? undefined
                : organizationSubscription
                  ? labels.switchPlan
                  : labels.upgrade;

            return (
              <PlanCard
                key={product.id}
                name={product.name}
                description={product.description}
                amount={product.prices[0]?.priceAmount ?? 0}
                intervalLabel={intervalLabel}
                isCurrent={isCurrent}
                currentLabel={labels.current}
                actionLabel={actionLabel}
                isDisabled={canManageBilling !== true}
                isLoading={isLoading}
                onAction={() => {
                  if (organizationSubscription) {
                    onPlanChange(product.id);
                    return;
                  }
                  onCheckout(product.id);
                }}
              />
            );
          })}

          {paidPlans.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              {labels.loadingPaidPlans}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 py-3 dark:bg-card">
        <p className="text-sm font-normal text-muted-foreground">
          {canManageBilling === false
            ? labels.managedByOrg
            : labels.noChargeTest}
        </p>
      </div>
    </div>
  );
}

function ManageSubscriptionSection({
  canManageBilling,
  isManagingPortal,
  isPending,
  labels,
  onManageSubscription,
}: {
  canManageBilling: boolean | undefined;
  isManagingPortal: boolean;
  isPending: boolean;
  labels: {
    manage: string;
    manageDescription: string;
    manageSubscription: string;
    managedByOrg: string;
    redirectPortal: string;
  };
  onManageSubscription: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 p-6">
        <h2 className="text-xl font-medium text-foreground">
          {labels.manageSubscription}
        </h2>
        <p className="flex items-start gap-1 text-sm font-normal text-muted-foreground">
          {canManageBilling === false
            ? labels.managedByOrg
            : labels.manageDescription}
        </p>
      </div>

      <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 py-3 dark:bg-card">
        <p className="text-sm font-normal text-muted-foreground">
          {canManageBilling === false
            ? labels.managedByOrg
            : labels.redirectPortal}
        </p>

        {canManageBilling === true ? (
          <Button
            type="button"
            size="sm"
            onClick={onManageSubscription}
            disabled={isManagingPortal || isPending}
          >
            {isManagingPortal ? "Working…" : labels.manage}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function BillingSettingsContent() {
  const locale = useCurrentLocale();
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const t = useScopedI18n("billing");
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const catalogProducts = useQuery(api.subscriptions.listCatalogProducts);
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
  const createOrganizationCustomerPortalUrl = useAction(
    api.subscriptions.createOrganizationCustomerPortalUrl,
  );
  const organizationDetails = useQuery(
    api.organizations.get,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );
  const acknowledgeTransferredPlan = useMutation(
    api.organizationDeletion.acknowledgeTransferredPlan,
  );

  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("month");
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [isManagingPortal, setIsManagingPortal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const syncedCheckoutRef = useRef(false);
  const products: BillingProduct[] = catalogProducts ?? [];

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
    void (async () => {
      await syncOrganizationSubscription({
        organizationId: currentOrganizationId,
      });
      if (organizationDetails?.requiresPlanSelection) {
        await acknowledgeTransferredPlan({
          organizationId: currentOrganizationId,
        });
      }
    })();
  }, [
    acknowledgeTransferredPlan,
    canManageBilling,
    currentOrganizationId,
    getSearchParam,
    organizationDetails?.requiresPlanSelection,
    syncOrganizationSubscription,
  ]);

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
        if (organizationDetails?.requiresPlanSelection) {
          await acknowledgeTransferredPlan({
            organizationId: currentOrganizationId,
          });
        }
      } finally {
        setPendingProductId(null);
      }
    });
  };

  const handleKeepDefaultPlan = () => {
    startTransition(async () => {
      try {
        await acknowledgeTransferredPlan({
          organizationId: currentOrganizationId,
        });
      } catch {
        // Owner can retry from billing page.
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
  const defaultTransferredTier =
    organizationDetails?.preservedSubscriptionTier ??
    organizationDetails?.subscriptionTier ??
    "free";

  return (
    <div className="flex size-full flex-col gap-6">
      <BillingOverview />

      {organizationDetails?.requiresPlanSelection ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">
            {t("planSelectionRequired", { tier: defaultTransferredTier })}
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleKeepDefaultPlan}
            >
              {isPending
                ? t("confirmingPlan")
                : t("keepDefaultPlan", { tier: defaultTransferredTier })}
            </Button>
          </div>
        </div>
      ) : null}

      <PlanUsageStats
        organizationId={currentOrganizationId}
        showUpgradeLink={false}
      />

      <BillingPlansSection
        billingInterval={billingInterval}
        canManageBilling={canManageBilling}
        currentProductId={currentProductId}
        currentTier={currentTier}
        intervalLabel={monthlyLabel}
        isPending={isPending}
        labels={{
          current: t("current"),
          currentPlan: t("currentPlan"),
          expires: t("expires"),
          free: t("free"),
          freeDescription: t("freeDescription"),
          loadingPaidPlans: "Loading paid plans…",
          managedByOrg: t("managedByOrg"),
          monthly: t("monthly"),
          noChargeTest: t("noChargeTest"),
          on: t("on"),
          perMonth: t("perMonth"),
          perYear: t("perYear"),
          plan: t("plan"),
          renews: t("renews"),
          switchPlan: t("switchPlan"),
          title: t("title"),
          upgrade: t("upgrade"),
          yearly: t("yearly"),
        }}
        onBillingIntervalChange={() =>
          setBillingInterval((state) => (state === "month" ? "year" : "month"))
        }
        onCheckout={handleCheckout}
        onPlanChange={handlePlanChange}
        organizationSubscription={organizationSubscription}
        paidPlans={paidPlans}
        pendingProductId={pendingProductId}
        subscriptionDate={subscriptionDate}
      />

      {organizationSubscription ? (
        <ManageSubscriptionSection
          canManageBilling={canManageBilling}
          isManagingPortal={isManagingPortal}
          isPending={isPending}
          labels={{
            manage: t("manage"),
            manageDescription: t("manageDescription"),
            manageSubscription: t("manageSubscription"),
            managedByOrg: t("managedByOrg"),
            redirectPortal: t("redirectPortal"),
          }}
          onManageSubscription={handleManageSubscription}
        />
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
