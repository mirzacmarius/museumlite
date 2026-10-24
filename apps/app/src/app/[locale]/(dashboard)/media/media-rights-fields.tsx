"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { RightsStatementSelect } from "@/components/rights-statement/rights-statement-select";
import { useOrganizationRightsDefaults } from "@/components/rights-statement/use-organization-rights-defaults";
import { useI18n } from "@/locales/client";
import {
  LICENSE_TYPES,
  type MediaRightsValues,
  RIGHTS_STATUSES,
} from "./media-rights";

const RIGHTS_STATEMENT_ID = "media-rights-statement";

/**
 * The rights recorded for a file, which decide whether the portal may show
 * it, and the rights statement shown with it there.
 */
export function MediaRightsFields({
  organizationId,
  values,
  onChange,
}: {
  organizationId: Id<"organizations">;
  values: MediaRightsValues;
  onChange: (change: Partial<MediaRightsValues>) => void;
}) {
  const t = useI18n();
  const defaults = useOrganizationRightsDefaults(organizationId);
  return (
    <>
      <div className="space-y-1 text-xs text-zinc-300">
        <label htmlFor={RIGHTS_STATEMENT_ID}>
          {t("mediaPage.publication.rightsStatement")}
        </label>
        <RightsStatementSelect
          id={RIGHTS_STATEMENT_ID}
          value={values.rightsStatement}
          onValueChange={(value) => onChange({ rightsStatement: value })}
          organizationDefault={
            defaults && (defaults.mediaRightsStatement ?? null)
          }
        />
        <p className="text-zinc-500">
          {t("mediaPage.publication.rightsStatementHint")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-zinc-300">
          <span>{t("mediaPage.publication.rightsStatus")}</span>
          <select
            value={values.rightsStatus}
            onChange={(event) =>
              onChange({
                rightsStatus:
                  RIGHTS_STATUSES.find(
                    (status) => status === event.target.value,
                  ) ?? "unknown",
              })
            }
            className="w-full rounded border border-white/10 bg-zinc-950 p-2"
          >
            {RIGHTS_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-300">
          <span>{t("mediaPage.publication.licenseType")}</span>
          <select
            value={values.licenseType}
            onChange={(event) =>
              onChange({
                licenseType:
                  LICENSE_TYPES.find(
                    (license) => license === event.target.value,
                  ) ?? "",
              })
            }
            className="w-full rounded border border-white/10 bg-zinc-950 p-2"
          >
            <option value="">{t("mediaPage.publication.noLicense")}</option>
            {LICENSE_TYPES.map((license) => (
              <option key={license} value={license}>
                {license.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-300">
          <span>{t("mediaPage.publication.expiry")}</span>
          <input
            type="date"
            value={values.licenseExpiry}
            onChange={(event) =>
              onChange({ licenseExpiry: event.target.value })
            }
            className="w-full rounded border border-white/10 bg-zinc-950 p-2"
          />
        </label>
        <label className="space-y-1 text-xs text-zinc-300">
          <span>{t("mediaPage.publication.restrictions")}</span>
          <input
            type="text"
            value={values.usageRestrictions}
            onChange={(event) =>
              onChange({ usageRestrictions: event.target.value })
            }
            className="w-full rounded border border-white/10 bg-zinc-950 p-2"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={values.requiresAcknowledgment}
          onChange={(event) =>
            onChange({ requiresAcknowledgment: event.target.checked })
          }
        />
        {t("mediaPage.publication.acknowledgment")}
      </label>
    </>
  );
}
