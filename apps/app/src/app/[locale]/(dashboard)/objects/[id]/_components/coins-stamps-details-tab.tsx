"use client";

import { Badge } from "@v1/ui/badge";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
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
import { RecordedValue } from "@/components/recorded-value";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useI18n, useScopedI18n } from "@/locales/client";
import { DetailField, DetailGrid, DetailSection } from "./detail-section";
import type { TypeDetailsRecord } from "./types";

interface CoinsStampsDetailsTabProps {
  details: TypeDetailsRecord<"coins_stamps"> | null;
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

export function CoinsStampsDetailsTab({ details }: CoinsStampsDetailsTabProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("modules.coins_stamps");
  const common = useScopedI18n("modules.common");
  const { hasModule } = useFeatureAccess();
  const hasModuleAccess = hasModule("coins_stamps");

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

  if (details === null) {
    return (
      <div className="space-y-6">
        <EmptyState
          variant="card"
          size="sm"
          title={common("noDetailsYet", { module: "coins and stamps" })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            {details.itemCategory === "stamp" ? (
              <Stamp className="size-4 text-muted-foreground" />
            ) : (
              <Coins className="size-4 text-muted-foreground" />
            )}
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Landmark className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Hash className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <BadgeCheck className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
        <DetailSection title={t("classification")} icon={ScrollText}>
          <DetailGrid>
            <DetailField
              label={t("denomination")}
              value={details.denomination}
            />
            <DetailField label={t("currency")} value={details.currency} />
            <DetailField
              label={t("mintOrPrinter")}
              value={details.mintOrPrinter}
            />
            <DetailField label={t("rarity")}>
              <Badge variant="secondary" className="capitalize">
                {formatRarity(details.rarity, tRoot)}
              </Badge>
            </DetailField>
          </DetailGrid>
        </DetailSection>

        <DetailSection title={t("conditionAndValue")} icon={ShieldCheck}>
          <DetailGrid>
            <DetailField label={t("estimatedValue")}>
              <RecordedValue value={details.estimatedValue} />
            </DetailField>
            <DetailField label={t("acquisitionPrice")}>
              <RecordedValue value={details.acquisitionPrice} />
            </DetailField>
            <DetailField
              label={t("certificationNumber")}
              value={details.certificationNumber}
            />
            <DetailField
              label={t("storageLocation")}
              value={details.storageLocation}
            />
          </DetailGrid>
        </DetailSection>
      </div>

      {(details.composition ||
        details.diameterMm ||
        details.weightGrams ||
        details.perforation ||
        details.watermark ||
        details.color ||
        details.notes) && (
        <DetailSection title={t("technicalDetails")}>
          <DetailGrid className="md:grid-cols-3">
            <DetailField label={t("composition")} value={details.composition} />
            <DetailField label={t("diameter")}>
              <div className="text-sm text-foreground">
                {details.diameterMm ? `${details.diameterMm} mm` : "—"}
              </div>
            </DetailField>
            <DetailField label={t("weight")}>
              <div className="text-sm text-foreground">
                {details.weightGrams ? `${details.weightGrams} g` : "—"}
              </div>
            </DetailField>
            <DetailField label={t("perforation")} value={details.perforation} />
            <DetailField label={t("watermark")} value={details.watermark} />
            <DetailField label={t("color")} value={details.color} />
          </DetailGrid>
          {details.notes ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {details.notes}
            </p>
          ) : null}
        </DetailSection>
      )}
    </div>
  );
}
