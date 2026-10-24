"use client";

import {
  MEASUREMENT_SETS_MAX,
  MEASUREMENT_TEXT_MAX_LENGTH,
  NUMBER_OF_OBJECTS_MAX,
  SUBJECT_TERM_MAX_LENGTH,
  SUBJECTS_MAX,
} from "@v1/backend/convex/utils/objectDescription";
import { useMemo } from "react";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import type { CollectionFormRuleMessages } from "./utils";

/** What the catalog form rules say, in the app language. */
export function useCollectionFormRuleMessages(): CollectionFormRuleMessages {
  const t = useScopedI18n("objects");
  const tErrors = useScopedI18n("recordForm.errors");
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  return useMemo(() => {
    const number = (value: number) => formatNumber(value, locale);
    return {
      titleRequired: t("form.errors.titleRequired"),
      weightInvalid: tErrors("weightInvalid"),
      measurementInvalid: tErrors("measurementInvalid"),
      productionDateInvalid: t("form.productionDate.invalid"),
      productionDateOpenInRange: t("form.productionDate.openInRange"),
      numberOfObjectsInvalid: tErrors("objectCountInvalid", {
        max: number(NUMBER_OF_OBJECTS_MAX),
      }),
      subjectsInvalid: tErrors("subjectsInvalid", {
        max: number(SUBJECTS_MAX),
        length: number(SUBJECT_TERM_MAX_LENGTH),
      }),
      measurementSetPartRequired: tErrors("measurementSetPartRequired"),
      measurementSetsInvalid: tErrors("measurementSetsInvalid", {
        max: number(MEASUREMENT_SETS_MAX),
        length: number(MEASUREMENT_TEXT_MAX_LENGTH),
      }),
      completenessNoteTooLong: tErrors("textTooLong", {
        field: tRoot("recordForm.objectFields.completenessNote"),
      }),
    };
  }, [locale, t, tErrors, tRoot]);
}
