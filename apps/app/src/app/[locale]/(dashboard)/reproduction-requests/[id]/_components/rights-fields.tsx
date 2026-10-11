"use client";

import { useScopedI18n } from "@/locales/client";
import { useCalendarDate } from "../../_components/request-status";
import { Field } from "./section";

const RIGHTS_STATUSES = [
  "owned",
  "licensed",
  "public_domain",
  "orphan_work",
  "restricted",
  "unknown",
] as const;
const LICENSE_TYPES = [
  "creative_commons_by",
  "creative_commons_by_sa",
  "creative_commons_by_nc",
  "creative_commons_by_nd",
  "creative_commons_zero",
  "editorial_only",
  "commercial",
  "internal_only",
  "custom",
] as const;

interface Rights {
  rightsStatus?: string;
  licenseType?: string;
  licenseExpiry?: number;
  rightsHolder?: string;
  copyright?: string;
  usageRestrictions?: string;
}

/** An image's rights as recorded, with known values translated. */
export function RightsFields({ rights }: { rights: Rights }) {
  const t = useScopedI18n("reproductionRequests");
  const formatCalendarDate = useCalendarDate();
  const notRecorded = t("detail.notRecorded");
  const rightsStatus = RIGHTS_STATUSES.find(
    (status) => status === rights.rightsStatus,
  );
  const licenseType = LICENSE_TYPES.find(
    (license) => license === rights.licenseType,
  );
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Field label={t("detail.rightsStatus")}>
        {rightsStatus
          ? t(`rightsStatuses.${rightsStatus}`)
          : (rights.rightsStatus ?? notRecorded)}
      </Field>
      <Field label={t("detail.licenseType")}>
        {licenseType
          ? t(`licenseTypes.${licenseType}`)
          : (rights.licenseType ?? notRecorded)}
      </Field>
      <Field label={t("detail.licenseExpiry")}>
        {rights.licenseExpiry !== undefined
          ? formatCalendarDate(rights.licenseExpiry)
          : notRecorded}
      </Field>
      <Field label={t("detail.rightsHolder")}>
        {rights.rightsHolder || notRecorded}
      </Field>
      <Field label={t("detail.copyright")}>
        {rights.copyright || notRecorded}
      </Field>
      <Field label={t("detail.usageRestrictions")}>
        {rights.usageRestrictions || notRecorded}
      </Field>
    </dl>
  );
}
