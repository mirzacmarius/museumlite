"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  REGISTER_FEATURES,
  REGISTER_PERMISSIONS,
  REGISTER_PROFILES,
  REGISTER_TOTALS,
} from "@v1/backend/convex/utils/registerProfiles";
import { Button } from "@v1/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v1/ui/card";
import { Label } from "@v1/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BookText, Loader2 } from "lucide-react";
import { useState } from "react";
import { ExportJobControl } from "@/components/export-job-control";
import { usePermissions } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useRegisterProfileLabels } from "@/hooks/use-register-profile-labels";
import { exportJobErrorKey } from "@/lib/export-job-error-copy";
import { formatIsoTimestamp } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";
import {
  criteriaFromForm,
  EMPTY_REGISTER_FORM,
  hasValidCriteriaShape,
  isProfile,
  type Profile,
  type RegisterForm,
  type RegisterSource,
} from "./register-criteria";
import { RegisterCriteriaFields } from "./register-criteria-fields";

type Preview = FunctionReturnType<typeof api.registers.preview>;

type ProfileGroup = "groupRegisters" | "groupFinancial" | "groupResearch";
const PROFILE_GROUP_ORDER: readonly ProfileGroup[] = [
  "groupRegisters",
  "groupFinancial",
  "groupResearch",
];
/** The picker group of every profile, so a new profile cannot be left out. */
const PROFILE_GROUPS: Record<Profile, ProfileGroup> = {
  accession: "groupRegisters",
  disposal: "groupRegisters",
  custody: "groupRegisters",
  condition: "groupRegisters",
  valuation: "groupFinancial",
  insurance: "groupFinancial",
  provenance: "groupResearch",
};

/**
 * Why the member cannot run a profile, if they cannot: their role first,
 * then the plan, as the capability matrix explains access.
 */
function useProfileUnavailability(organizationId: Id<"organizations">) {
  const { hasPermission, isLoading } = usePermissions();
  const { hasFeature } = useFeatureAccess();
  return (profile: Profile): "role" | "plan" | undefined => {
    if (isLoading) return undefined;
    if (!REGISTER_PERMISSIONS[profile].every(hasPermission)) return "role";
    if (
      !REGISTER_FEATURES[profile].every((feature) =>
        hasFeature(feature, organizationId),
      )
    )
      return "plan";
    return undefined;
  };
}

/** Stable keys for preview rows; identical legacy rows get an occurrence suffix. */
function keyedRows(rows: Preview["rows"]) {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const base = JSON.stringify(row);
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return { key: `${base}#${occurrence}`, row };
  });
}

function formatCell(
  value: string | number | boolean | null | undefined,
  type: string,
) {
  if (value === null || value === undefined) return "";
  if (type === "utcEpochMs" && typeof value === "number")
    return formatIsoTimestamp(value);
  return String(value);
}

interface PreviewState {
  loading: boolean;
  key?: string;
  result?: Preview;
  error?: string;
}

interface RegisterExportsCardProps {
  organizationId: Id<"organizations">;
}

export function RegisterExportsCard({
  organizationId,
}: RegisterExportsCardProps) {
  const t = useScopedI18n("registerReports");
  const tExport = useScopedI18n("exportJobs");
  const convex = useConvex();
  const [form, setForm] = useState<RegisterForm>(EMPTY_REGISTER_FORM);
  const [preview, setPreview] = useState<PreviewState>({ loading: false });
  const update = (patch: Partial<RegisterForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setPreview((current) => ({ ...current, error: undefined }));
  };

  const profileLabels = useRegisterProfileLabels();
  const unavailability = useProfileUnavailability(organizationId);
  const profileOption = (id: Profile) => {
    switch (unavailability(id)) {
      case "role":
        return t("profileNoRoleAccess", { profile: profileLabels[id] });
      case "plan":
        return t("profileNotInPlan", { profile: profileLabels[id] });
      default:
        return profileLabels[id];
    }
  };
  const { profile } = form;
  const criteria = criteriaFromForm(form);
  const source: RegisterSource = { kind: "register", profile, criteria };
  const sourceKey = JSON.stringify(source);
  const criteriaValid = hasValidCriteriaShape(criteria);
  const shownPreview = preview.key === sourceKey ? preview.result : undefined;
  const previewing = preview.loading;
  const error = preview.error;

  async function runPreview() {
    const now = Date.now();
    if (
      !criteriaValid ||
      (criteria.asOf !== undefined && criteria.asOf > now)
    ) {
      setPreview({ loading: false, error: tExport("errorRegisterCriteria") });
      return;
    }
    setPreview({ loading: true });
    try {
      const result = await convex.query(api.registers.preview, {
        organizationId,
        profile,
        criteria,
        now,
      });
      setPreview({ loading: false, key: sourceKey, result });
    } catch (e) {
      setPreview({ loading: false, error: tExport(exportJobErrorKey(e)) });
    }
  }

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookText className="size-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="register-profile">{t("profile")}</Label>
            <select
              id="register-profile"
              value={profile}
              onChange={(e) => {
                if (isProfile(e.target.value))
                  update({ profile: e.target.value });
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-2"
            >
              {PROFILE_GROUP_ORDER.map((group) => (
                <optgroup key={group} label={t(group)}>
                  {REGISTER_PROFILES.filter(
                    (id) => PROFILE_GROUPS[id] === group,
                  ).map((id) => (
                    <option
                      key={id}
                      value={id}
                      disabled={unavailability(id) !== undefined}
                    >
                      {profileOption(id)}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label={t("groupUnsupported")}>
                <option value="spectrum" disabled>
                  {t("profileSpectrum")}
                </option>
                <option value="lido" disabled>
                  {t("profileLido")}
                </option>
              </optgroup>
            </select>
          </div>
          <RegisterCriteriaFields
            organizationId={organizationId}
            form={form}
            update={update}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("asOfHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={previewing || !criteriaValid}
            onClick={() => void runPreview()}
          >
            {previewing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {previewing ? t("previewing") : t("preview")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {shownPreview && (
          <section aria-label={t("previewLabel")} className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {shownPreview.pageRows === 0
                ? t("previewEmpty")
                : t("previewSummary", {
                    shown: shownPreview.rows.length,
                    rows: shownPreview.pageRows,
                    scanned: shownPreview.scanned,
                  })}{" "}
              {shownPreview.hasMore ? t("previewMore") : ""}
            </p>
            <div className="max-h-80 overflow-auto rounded-md border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    {shownPreview.columns.map((column) => (
                      <TableHead
                        key={column.name}
                        className="whitespace-nowrap"
                      >
                        {column.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {column.type}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keyedRows(shownPreview.rows).map(({ key, row }) => (
                    <TableRow key={key}>
                      {shownPreview.columns.map((column) => (
                        <TableCell
                          key={column.name}
                          className="whitespace-nowrap text-xs"
                        >
                          {formatCell(row[column.name], column.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("notRecordedNote")}
            </p>
            {REGISTER_TOTALS[profile] && (
              <p className="text-xs text-muted-foreground">
                {t("totalsPreviewNote")}
              </p>
            )}
          </section>
        )}
        {criteriaValid ? (
          <ExportJobControl
            organizationId={organizationId}
            source={source}
            label={t("exportLabel", { profile: profileLabels[profile] })}
          />
        ) : (
          <p role="alert" className="text-destructive">
            {tExport("errorRegisterCriteria")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("unsupportedNote")}</p>
      </CardContent>
    </Card>
  );
}
