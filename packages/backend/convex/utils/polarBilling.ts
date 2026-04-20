import type { Product } from "@polar-sh/sdk/models/components/product.js";

export type PaidSubscriptionTier = "pro" | "enterprise";
export type SubscriptionTier = "free" | PaidSubscriptionTier;
export type SubscriptionRecordSource = {
  id: string;
  customerId: string;
  createdAt: string | Date;
  modifiedAt: string | Date | null;
  productId: string;
  priceId: string;
  checkoutId: string | null;
  amount: number | null;
  currency: string | null;
  recurringInterval: "month" | "year" | null;
  status: string;
  currentPeriodStart: string | Date;
  currentPeriodEnd: string | Date | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string | Date | null;
  endedAt: string | Date | null;
  metadata: Record<string, string | number | boolean>;
};
export type DatabaseSubscriptionRecord = {
  id: string;
  customerId: string;
  createdAt: string;
  modifiedAt: string | null;
  productId: string;
  priceId: string;
  checkoutId: string | null;
  amount: number | null;
  currency: string | null;
  recurringInterval: "month" | "year" | null;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string | null;
  endedAt: string | null;
  metadata: Record<string, string | number | boolean>;
};
export type DatabaseProductRecord = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isRecurring: boolean;
  isArchived: boolean;
  createdAt: string;
  modifiedAt: string | null;
  recurringInterval: "month" | "year" | null;
  prices: Array<{
    id: string;
    productId: string;
    amountType?: string;
    isArchived: boolean;
    createdAt: string;
    modifiedAt: string | null;
    recurringInterval?: "month" | "year";
    priceAmount?: number;
    priceCurrency?: string;
    minimumAmount?: number;
    maximumAmount?: number;
    presetAmount?: number;
    type?: string;
  }>;
  medias: Array<{
    id: string;
    organizationId: string;
    name: string;
    path: string;
    mimeType: string;
    size: number;
    storageVersion: string | null;
    checksumEtag: string | null;
    checksumSha256Base64: string | null;
    checksumSha256Hex: string | null;
    createdAt: string;
    lastModifiedAt: string | null;
    version: string | null;
    isUploaded: boolean;
    sizeReadable: string;
    publicUrl: string;
  }>;
};

export const BILLING_PLAN_DEFINITIONS = [
  {
    tier: "pro" as const,
    interval: "month" as const,
    name: "Pro",
    description: "Advanced workflows and reporting for growing collections.",
    priceAmount: 2000,
  },
  {
    tier: "pro" as const,
    interval: "year" as const,
    name: "Pro",
    description: "Advanced workflows and reporting for growing collections.",
    priceAmount: 20000,
  },
  {
    tier: "enterprise" as const,
    interval: "month" as const,
    name: "Enterprise",
    description: "Unlimited capacity and premium controls for larger teams.",
    priceAmount: 9900,
  },
  {
    tier: "enterprise" as const,
    interval: "year" as const,
    name: "Enterprise",
    description: "Unlimited capacity and premium controls for larger teams.",
    priceAmount: 99000,
  },
];

export function inferSubscriptionTierFromProductName(
  productName: string,
): PaidSubscriptionTier | null {
  const normalizedName = productName.trim().toLowerCase();

  if (normalizedName.includes("enterprise")) {
    return "enterprise";
  }

  if (normalizedName.includes("pro")) {
    return "pro";
  }

  return null;
}

export function hasActiveSubscriptionAccess(args: {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
}): boolean {
  if (args.status === "active") {
    return true;
  }

  return Boolean(
    args.cancelAtPeriodEnd &&
      args.currentPeriodEnd !== null &&
      args.currentPeriodEnd > Date.now(),
  );
}

export function toDatabaseSubscription(
  subscription: SubscriptionRecordSource,
): DatabaseSubscriptionRecord {
  const createdAt =
    subscription.createdAt instanceof Date
      ? subscription.createdAt.toISOString()
      : subscription.createdAt;
  const modifiedAt =
    subscription.modifiedAt instanceof Date
      ? subscription.modifiedAt.toISOString()
      : subscription.modifiedAt;
  const currentPeriodStart =
    subscription.currentPeriodStart instanceof Date
      ? subscription.currentPeriodStart.toISOString()
      : subscription.currentPeriodStart;
  const currentPeriodEnd =
    subscription.currentPeriodEnd instanceof Date
      ? subscription.currentPeriodEnd.toISOString()
      : subscription.currentPeriodEnd;
  const startedAt =
    subscription.startedAt instanceof Date
      ? subscription.startedAt.toISOString()
      : subscription.startedAt;
  const endedAt =
    subscription.endedAt instanceof Date
      ? subscription.endedAt.toISOString()
      : subscription.endedAt;

  return {
    id: subscription.id,
    customerId: subscription.customerId,
    createdAt,
    modifiedAt,
    productId: subscription.productId,
    priceId: subscription.priceId,
    checkoutId: subscription.checkoutId,
    amount: subscription.amount,
    currency: subscription.currency,
    recurringInterval: subscription.recurringInterval,
    status: subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    startedAt,
    endedAt,
    metadata: subscription.metadata,
  };
}

export function toDatabaseProduct(product: Product): DatabaseProductRecord {
  return {
    id: product.id,
    organizationId: product.organizationId,
    name: product.name,
    description: product.description,
    isRecurring: product.isRecurring,
    isArchived: product.isArchived,
    createdAt: product.createdAt.toISOString(),
    modifiedAt: product.modifiedAt?.toISOString() ?? null,
    recurringInterval: product.recurringInterval,
    prices: product.prices.map((price) => ({
      id: price.id,
      productId: price.productId,
      amountType: price.amountType,
      isArchived: price.isArchived,
      createdAt: price.createdAt.toISOString(),
      modifiedAt: price.modifiedAt?.toISOString() ?? null,
      recurringInterval:
        price.type === "recurring"
          ? price.recurringInterval ?? undefined
          : undefined,
      priceAmount: price.amountType === "fixed" ? price.priceAmount : undefined,
      priceCurrency:
        price.amountType === "fixed" || price.amountType === "custom"
          ? price.priceCurrency
          : undefined,
      minimumAmount:
        price.amountType === "custom"
          ? price.minimumAmount ?? undefined
          : undefined,
      maximumAmount:
        price.amountType === "custom"
          ? price.maximumAmount ?? undefined
          : undefined,
      presetAmount:
        price.amountType === "custom"
          ? price.presetAmount ?? undefined
          : undefined,
      type: price.type,
    })),
    medias: product.medias.map((media) => ({
      id: media.id,
      organizationId: media.organizationId,
      name: media.name,
      path: media.path,
      mimeType: media.mimeType,
      size: media.size,
      storageVersion: media.storageVersion,
      checksumEtag: media.checksumEtag,
      checksumSha256Base64: media.checksumSha256Base64,
      checksumSha256Hex: media.checksumSha256Hex,
      createdAt: media.createdAt.toISOString(),
      lastModifiedAt: media.lastModifiedAt?.toISOString() ?? null,
      version: media.version,
      isUploaded: media.isUploaded,
      sizeReadable: media.sizeReadable,
      publicUrl: media.publicUrl,
    })),
  };
}
