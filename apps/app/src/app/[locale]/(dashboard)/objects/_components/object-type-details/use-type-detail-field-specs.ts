"use client";

import type { ObjectDraftTypeDetailFields } from "@v1/backend/convex/utils/collectionTypeDetailFields";
import type { CollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";
import { useMemo } from "react";
import { useI18n } from "@/locales/client";

type FieldSpecFor<V> = [NonNullable<V>] extends [boolean]
  ? { kind: "boolean"; label: string }
  : [NonNullable<V>] extends [number]
    ? { kind: "number" | "date"; label: string }
    : [NonNullable<V>] extends [string[]]
      ? { kind: "list"; label: string }
      : string extends NonNullable<V>
        ? { kind: "text" | "textarea" | "url"; label: string }
        : {
            kind: "select";
            label: string;
            options: Record<NonNullable<V> & string, string>;
          };

/** One spec per intake field of a collection type, in display order. */
type TypeDetailFieldSpecs<T extends CollectionModuleId> = {
  [K in keyof ObjectDraftTypeDetailFields<T>]-?: FieldSpecFor<
    ObjectDraftTypeDetailFields<T>[K]
  >;
};

export type TypeDetailFieldSpec =
  | { kind: "boolean"; label: string }
  | { kind: "number" | "date"; label: string }
  | { kind: "list"; label: string }
  | { kind: "text" | "textarea" | "url"; label: string }
  | { kind: "select"; label: string; options: Record<string, string> };

export function useTypeDetailFieldSpecs() {
  const t = useI18n();

  return useMemo(() => {
    const fineArt: TypeDetailFieldSpecs<"fine_art"> = {
      appraisedValue: {
        kind: "number",
        label: t("modules.fineArt.appraisedValue"),
      },
      replacementValue: {
        kind: "number",
        label: t("modules.fineArt.replacementValue"),
      },
      appraiser: {
        kind: "text",
        label: t("objectTypeDetails.fields.appraiser"),
      },
      lastAppraisalDate: {
        kind: "date",
        label: t("objectTypeDetails.fields.lastAppraisalDate"),
      },
      reappraisalDate: {
        kind: "date",
        label: t("modules.fineArt.reappraisalDue"),
      },
      insurancePolicyNumber: {
        kind: "text",
        label: t("modules.fineArt.insurancePolicy"),
      },
      insuranceCarrier: {
        kind: "text",
        label: t("objectTypeDetails.fields.insuranceCarrier"),
      },
      insuranceExpiresAt: {
        kind: "date",
        label: t("objectTypeDetails.fields.insuranceExpiresAt"),
      },
      displayStatus: {
        kind: "select",
        label: t("modules.fineArt.displayStatus"),
        options: {
          on_display: t("objects.filters.onDisplay"),
          in_storage: t("objectTypeDetails.options.inStorage"),
          loaned_out: t("objects.filters.loaned"),
          in_transit: t("loans.kpis.inTransit"),
          conservation: t("untranslatedRecords.objects.tabs.conservation"),
        },
      },
    };

    const wine: TypeDetailFieldSpecs<"wine"> = {
      producer: { kind: "text", label: t("modules.wine.producer") },
      vintage: { kind: "number", label: t("modules.wine.vintage") },
      region: { kind: "text", label: t("modules.wine.region") },
      appellation: { kind: "text", label: t("modules.wine.appellation") },
      varietal: { kind: "text", label: t("modules.wine.varietal") },
      alcoholContent: {
        kind: "number",
        label: t("modules.wine.alcoholContent"),
      },
      bottleSize: { kind: "text", label: t("modules.wine.bottleSize") },
      quantity: { kind: "number", label: t("modules.wine.quantity") },
      binNumber: { kind: "text", label: t("modules.wine.bin") },
      rackNumber: { kind: "text", label: t("modules.wine.rack") },
      rowNumber: { kind: "text", label: t("modules.wine.row") },
      peakWindowStart: {
        kind: "number",
        label: t("objectTypeDetails.fields.peakWindowStart"),
      },
      peakWindowEnd: {
        kind: "number",
        label: t("objectTypeDetails.fields.peakWindowEnd"),
      },
      fillLevel: {
        kind: "select",
        label: t("modules.wine.fillLevel"),
        options: {
          into_neck: t("untranslatedRecords.objects.enums.fillIntoNeck"),
          top_shoulder: t("untranslatedRecords.objects.enums.fillTopShoulder"),
          high_shoulder: t(
            "untranslatedRecords.objects.enums.fillHighShoulder",
          ),
          mid_shoulder: t("untranslatedRecords.objects.enums.fillMidShoulder"),
          low_shoulder: t("untranslatedRecords.objects.enums.fillLowShoulder"),
          below_shoulder: t(
            "untranslatedRecords.objects.enums.fillBelowShoulder",
          ),
        },
      },
      closureType: {
        kind: "select",
        label: t("modules.wine.closure"),
        options: {
          cork: t("objectTypeDetails.options.cork"),
          screwcap: t("objectTypeDetails.options.screwcap"),
          synthetic: t("objectTypeDetails.options.synthetic"),
          glass: t("objectTypeDetails.options.glass"),
          crown: t("objectTypeDetails.options.crown"),
        },
      },
      labelCondition: { kind: "text", label: t("modules.wine.labelCondition") },
      capsuleCondition: { kind: "text", label: t("modules.wine.capsule") },
      purchasePrice: { kind: "number", label: t("modules.wine.purchasePrice") },
      currentValue: { kind: "number", label: t("modules.wine.currentValue") },
      drinkingNotes: {
        kind: "textarea",
        label: t("modules.wine.tastingNotes"),
      },
    };

    const automotive: TypeDetailFieldSpecs<"automotive"> = {
      make: { kind: "text", label: t("objectTypeDetails.fields.make") },
      model: { kind: "text", label: t("objectTypeDetails.fields.model") },
      year: { kind: "number", label: t("objectTypeDetails.fields.year") },
      vin: { kind: "text", label: t("modules.vehicle.vin") },
      bodyStyle: { kind: "text", label: t("modules.vehicle.bodyStyle") },
      engineNumber: { kind: "text", label: t("modules.vehicle.engineNumber") },
      transmissionType: {
        kind: "text",
        label: t("modules.vehicle.transmission"),
      },
      fuelType: { kind: "text", label: t("modules.vehicle.fuelType") },
      exteriorColor: { kind: "text", label: t("modules.vehicle.exterior") },
      interiorColor: { kind: "text", label: t("modules.vehicle.interior") },
      odometer: { kind: "number", label: t("modules.vehicle.odometer") },
      odometerUnit: {
        kind: "select",
        label: t("objectTypeDetails.fields.odometerUnit"),
        options: {
          miles: t("objectTypeDetails.options.miles"),
          km: t("objectTypeDetails.options.kilometres"),
        },
      },
      registrationNumber: {
        kind: "text",
        label: t("modules.vehicle.plateNumber"),
      },
      registrationState: { kind: "text", label: t("modules.vehicle.state") },
      titleNumber: { kind: "text", label: t("modules.vehicle.titleNumber") },
      insuranceValue: {
        kind: "number",
        label: t("modules.vehicle.insuranceValue"),
      },
    };

    const naturalHistory: TypeDetailFieldSpecs<"natural_history"> = {
      scientificName: {
        kind: "text",
        label: t("modules.naturalHistory.scientificName"),
      },
      commonName: {
        kind: "text",
        label: t("modules.naturalHistory.commonName"),
      },
      kingdom: { kind: "text", label: t("modules.naturalHistory.kingdom") },
      phylum: { kind: "text", label: t("modules.naturalHistory.phylum") },
      taxonomyClass: { kind: "text", label: t("modules.naturalHistory.class") },
      order: { kind: "text", label: t("modules.naturalHistory.order") },
      family: { kind: "text", label: t("modules.naturalHistory.family") },
      genus: { kind: "text", label: t("modules.naturalHistory.genus") },
      species: { kind: "text", label: t("modules.naturalHistory.species") },
      subspecies: {
        kind: "text",
        label: t("modules.naturalHistory.subspecies"),
      },
      specimenType: {
        kind: "text",
        label: t("modules.naturalHistory.specimenType"),
      },
      sex: {
        kind: "select",
        label: t("modules.naturalHistory.sex"),
        options: {
          male: t("objectTypeDetails.options.male"),
          female: t("objectTypeDetails.options.female"),
          unknown: t("modules.common.unknown"),
        },
      },
      lifeStage: { kind: "text", label: t("modules.naturalHistory.lifeStage") },
      collectionDate: {
        kind: "date",
        label: t("modules.naturalHistory.collectionDate"),
      },
      collectorName: {
        kind: "text",
        label: t("modules.naturalHistory.collector"),
      },
      collectionMethod: {
        kind: "text",
        label: t("modules.naturalHistory.collectionMethod"),
      },
      locality: { kind: "text", label: t("modules.naturalHistory.locality") },
      habitat: { kind: "text", label: t("modules.naturalHistory.habitat") },
      latitude: { kind: "number", label: t("modules.naturalHistory.latitude") },
      longitude: {
        kind: "number",
        label: t("modules.naturalHistory.longitude"),
      },
      altitude: { kind: "number", label: t("modules.naturalHistory.altitude") },
      geologicalPeriod: {
        kind: "text",
        label: t("modules.naturalHistory.geologicalPeriod"),
      },
      formation: { kind: "text", label: t("modules.naturalHistory.formation") },
      preservationMethod: {
        kind: "select",
        label: t("modules.naturalHistory.preservationMethod"),
        options: {
          dry: t("objectTypeDetails.options.dry"),
          wet: t("objectTypeDetails.options.wet"),
          frozen: t("objectTypeDetails.options.frozen"),
          pinned: t("objectTypeDetails.options.pinned"),
          pressed: t("objectTypeDetails.options.pressed"),
          mounted: t("objectTypeDetails.options.mounted"),
          cast: t("objectTypeDetails.options.cast"),
          fossil: t("objectTypeDetails.options.fossil"),
          other: t("objectTypeDetails.options.other"),
        },
      },
      storageMedium: {
        kind: "text",
        label: t("modules.naturalHistory.storageMedium"),
      },
      containerType: {
        kind: "text",
        label: t("modules.naturalHistory.containerType"),
      },
      dnaAvailable: {
        kind: "boolean",
        label: t("modules.naturalHistory.dnaAvailable"),
      },
      tissueAvailable: {
        kind: "boolean",
        label: t("modules.naturalHistory.tissueAvailable"),
      },
    };

    const archive: TypeDetailFieldSpecs<"archive"> = {
      documentType: { kind: "text", label: t("modules.archive.documentType") },
      recordSeries: { kind: "text", label: t("modules.archive.recordSeries") },
      originatingDepartment: {
        kind: "text",
        label: t("modules.archive.originatingDepartment"),
      },
      confidentialityLevel: {
        kind: "select",
        label: t("modules.archive.confidentialityLevel"),
        options: {
          public: t("untranslatedRecords.objects.enums.statusPublic"),
          internal: t("untranslatedRecords.objects.enums.statusInternal"),
          confidential: t(
            "untranslatedRecords.objects.enums.statusConfidential",
          ),
          restricted: t("untranslatedRecords.objects.enums.statusRestricted"),
          top_secret: t("untranslatedRecords.objects.enums.statusTopSecret"),
        },
      },
      accessRestrictions: {
        kind: "list",
        label: t("modules.archive.accessRestrictions"),
      },
      retentionCategory: {
        kind: "text",
        label: t("modules.archive.retentionCategory"),
      },
      retentionYears: {
        kind: "number",
        label: t("objectTypeDetails.fields.retentionYears"),
      },
      retentionStartDate: {
        kind: "date",
        label: t("modules.archive.retentionStartDate"),
      },
      retentionExpiresAt: {
        kind: "date",
        label: t("modules.archive.retentionExpires"),
      },
      boxNumber: { kind: "text", label: t("modules.archive.boxNumber") },
      folderNumber: { kind: "text", label: t("modules.archive.folderNumber") },
      digitalAssetUrl: {
        kind: "url",
        label: t("objectTypeDetails.fields.digitalAssetUrl"),
      },
      fileFormat: { kind: "text", label: t("modules.archive.fileFormat") },
      pageCount: { kind: "number", label: t("modules.archive.pageCount") },
      ocrProcessed: {
        kind: "boolean",
        label: t("modules.archive.ocrProcessed"),
      },
      keywords: { kind: "list", label: t("modules.archive.keywords") },
    };

    const coinsStamps: TypeDetailFieldSpecs<"coins_stamps"> = {
      itemCategory: {
        kind: "select",
        label: t("modules.coins_stamps.itemCategory"),
        options: {
          coin: t("untranslatedRecords.objects.enums.coin"),
          stamp: t("untranslatedRecords.objects.enums.stamp"),
        },
      },
      issuingAuthority: {
        kind: "text",
        label: t("modules.coins_stamps.issuer"),
      },
      countryOrRegion: {
        kind: "text",
        label: t("objectTypeDetails.fields.countryOrRegion"),
      },
      denomination: {
        kind: "text",
        label: t("modules.coins_stamps.denomination"),
      },
      currency: { kind: "text", label: t("modules.coins_stamps.currency") },
      issueYear: {
        kind: "number",
        label: t("objectTypeDetails.fields.issueYear"),
      },
      issuePeriod: {
        kind: "text",
        label: t("objectTypeDetails.fields.issuePeriod"),
      },
      mintOrPrinter: {
        kind: "text",
        label: t("modules.coins_stamps.mintOrPrinter"),
      },
      series: { kind: "text", label: t("objectTypeDetails.fields.series") },
      catalogNumber: {
        kind: "text",
        label: t("modules.coins_stamps.catalogNumber"),
      },
      grade: { kind: "text", label: t("modules.coins_stamps.grade") },
      certificationNumber: {
        kind: "text",
        label: t("modules.coins_stamps.certificationNumber"),
      },
      certifyingAuthority: {
        kind: "text",
        label: t("objectTypeDetails.fields.certifyingAuthority"),
      },
      rarity: {
        kind: "select",
        label: t("modules.coins_stamps.rarity"),
        options: {
          common: t("untranslatedRecords.objects.enums.rarityCommon"),
          scarce: t("untranslatedRecords.objects.enums.rarityScarce"),
          rare: t("untranslatedRecords.objects.enums.rarityRare"),
          very_rare: t("untranslatedRecords.objects.enums.rarityVeryRare"),
          unique: t("untranslatedRecords.objects.enums.rarityUnique"),
        },
      },
      composition: {
        kind: "text",
        label: t("modules.coins_stamps.composition"),
      },
      diameterMm: {
        kind: "number",
        label: t("objectTypeDetails.fields.diameterMm"),
      },
      weightGrams: {
        kind: "number",
        label: t("objectTypeDetails.fields.weightGrams"),
      },
      perforation: {
        kind: "text",
        label: t("modules.coins_stamps.perforation"),
      },
      watermark: { kind: "text", label: t("modules.coins_stamps.watermark") },
      color: { kind: "text", label: t("modules.coins_stamps.color") },
      acquisitionPrice: {
        kind: "number",
        label: t("modules.coins_stamps.acquisitionPrice"),
      },
      estimatedValue: {
        kind: "number",
        label: t("modules.coins_stamps.estimatedValue"),
      },
      storageLocation: {
        kind: "text",
        label: t("modules.coins_stamps.storageLocation"),
      },
      conditionNotes: {
        kind: "textarea",
        label: t("objectTypeDetails.fields.conditionNotes"),
      },
      notes: { kind: "textarea", label: t("objectTypeDetails.fields.notes") },
    };

    const fieldSpecs: Record<
      CollectionModuleId,
      Record<string, TypeDetailFieldSpec>
    > = {
      fine_art: fineArt,
      wine,
      automotive,
      natural_history: naturalHistory,
      archive,
      coins_stamps: coinsStamps,
    };

    const typeLabels: Record<CollectionModuleId, string> = {
      fine_art: t("untranslatedRecords.objects.tabs.fine_art"),
      wine: t("untranslatedRecords.objects.tabs.wine"),
      automotive: t("untranslatedRecords.objects.tabs.automotive"),
      natural_history: t("untranslatedRecords.objects.tabs.natural_history"),
      archive: t("untranslatedRecords.objects.tabs.archive"),
      coins_stamps: t("untranslatedRecords.objects.tabs.coins_stamps"),
    };

    return {
      fieldSpecs,
      typeLabels,
      booleanLabels: {
        yes: t("modules.common.yes"),
        no: t("modules.common.no"),
      },
      notSpecifiedLabel: t("modules.common.notSpecified"),
    };
  }, [t]);
}
