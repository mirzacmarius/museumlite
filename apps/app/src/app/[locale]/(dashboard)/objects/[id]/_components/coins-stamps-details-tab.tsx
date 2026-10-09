"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useQuery } from "convex/react";
import {
  BadgeCheck,
  Coins,
  Globe2,
  Hash,
  Landmark,
  ScrollText,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";

interface CoinsStampsDetailsTabProps {
  collectionId: string;
  organizationId: Id<"organizations">;
}

function formatCategory(
  category: "coin" | "stamp" | undefined,
  t: (key: string) => string,
) {
  if (category === "coin") return t("untranslatedRecords.objects.enums.coin");
  if (category === "stamp") return t("untranslatedRecords.objects.enums.stamp");
  return t("untranslatedRecords.objects.enums.unspecified");
}

function formatRarity(rarity: string | undefined, t: (key: string) => string) {
  switch (rarity) {
    case "common":
      return t("untranslatedRecords.objects.enums.rarityCommon");
    case "scarce":
      return t("untranslatedRecords.objects.enums.rarityScarce");
    case "rare":
      return t("untranslatedRecords.objects.enums.rarityRare");
    case "very_rare":
      return t("untranslatedRecords.objects.enums.rarityVeryRare");
    case "unique":
      return t("untranslatedRecords.objects.enums.rarityUnique");
    case undefined:
      return t("untranslatedRecords.objects.enums.notSpecified");
    default:
      return rarity;
  }
}

export function CoinsStampsDetailsTab({
  collectionId,
}: CoinsStampsDetailsTabProps) {
  const locale = useCurrentLocale();
  const tRoot = useI18n();
  const t = useScopedI18n("modules.coins_stamps");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("coins_stamps");
  const details = useQuery(
    api.coinsStampsDetails.get,
    hasModuleAccess
      ? { collectionId: collectionId as Id<"collections"> }
      : "skip",
  );

  if (!hasModuleAccess) {
    return (
      <FeatureGuard
        featureName={t("moduleName")}
        reason={{ kind: "module_disabled" }}
        description={t("moduleDescription")}
        showAction={false}
      >
        <div />
      </FeatureGuard>
    );
  }

  if (details === undefined) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {common("loading", { module: "coins and stamps" })}
        </p>
      </div>
    );
  }

  if (details === null) {
    return (
      <div className="space-y-6">
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {common("noDetailsYet", { module: "coins and stamps" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            {details.itemCategory === "stamp" ? (
              <Stamp className="size-4 text-sky-500" />
            ) : (
              <Coins className="size-4 text-amber-500" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("itemCategory")}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {formatCategory(details.itemCategory, tRoot)}
          </span>
          {details.series ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.series}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Landmark className="size-4 text-emerald-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("issuer")}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.issuingAuthority || common("unknown")}
          </span>
          {details.countryOrRegion ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Globe2 className="size-3" />
              {details.countryOrRegion}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Hash className="size-4 text-blue-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("catalogNumber")}
            </span>
          </div>
          <span className="font-mono text-sm font-medium text-foreground">
            {details.catalogNumber || "—"}
          </span>
          {details.issueYear ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.issueYear}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <BadgeCheck className="size-4 text-purple-500" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("grade")}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {details.grade || common("notAssessed")}
          </span>
          {details.certifyingAuthority ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {details.certifyingAuthority}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <ScrollText className="size-5 text-muted-foreground" />
            <h3 className="font-medium">{t("classification")}</h3>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("denomination")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.denomination || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("currency")}</dt>
              <dd className="text-sm text-foreground">
                {details.currency || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("mintOrPrinter")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.mintOrPrinter || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("rarity")}</dt>
              <dd>
                <Badge variant="secondary" className="capitalize">
                  {formatRarity(details.rarity, tRoot)}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            <h3 className="font-medium">{t("conditionAndValue")}</h3>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("estimatedValue")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.estimatedValue
                  ? formatCurrency(details.estimatedValue, locale, "USD")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("acquisitionPrice")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.acquisitionPrice
                  ? formatCurrency(details.acquisitionPrice, locale, "USD")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("certificationNumber")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.certificationNumber || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("storageLocation")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.storageLocation || "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {(details.composition ||
        details.diameterMm ||
        details.weightGrams ||
        details.perforation ||
        details.watermark ||
        details.color ||
        details.notes) && (
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="mb-4 font-medium">{t("technicalDetails")}</h3>
          <dl className="grid gap-4 md:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("composition")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.composition || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("diameter")}</dt>
              <dd className="text-sm text-foreground">
                {details.diameterMm ? `${details.diameterMm} mm` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("weight")}</dt>
              <dd className="text-sm text-foreground">
                {details.weightGrams ? `${details.weightGrams} g` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("perforation")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.perforation || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("watermark")}
              </dt>
              <dd className="text-sm text-foreground">
                {details.watermark || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("color")}</dt>
              <dd className="text-sm text-foreground">
                {details.color || "—"}
              </dd>
            </div>
          </dl>
          {details.notes ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {details.notes}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
