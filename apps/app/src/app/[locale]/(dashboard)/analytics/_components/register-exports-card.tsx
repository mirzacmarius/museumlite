"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v1/ui/card";
import { Input } from "@v1/ui/input";
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
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { BookText, Loader2 } from "lucide-react";
import { useState } from "react";
import { ExportJobControl } from "@/components/export-job-control";
import { exportJobErrorKey } from "@/lib/export-job-error-copy";
import { formatIsoTimestamp } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";

type RegisterSource = Extract<
  FunctionArgs<typeof api.exports.create>["source"],
  { kind: "register" }
>;
type Profile = RegisterSource["profile"];
type Criteria = RegisterSource["criteria"];
type Status = NonNullable<Criteria["status"]>;
type Preview = FunctionReturnType<typeof api.registers.preview>;

const DAY_MS = 24 * 60 * 60 * 1000;
const PROFILES: Profile[] = ["accession", "disposal", "custody", "condition"];
const STATUS_PROFILES = new Set<Profile>(["accession", "disposal"]);

function isProfile(value: string): value is Profile {
  return PROFILES.some((profile) => profile === value);
}
function isStatus(value: string): value is Status {
  return ["pending", "approved", "rejected"].includes(value);
}
/** `YYYY-MM-DD` as the first or last UTC millisecond of that day. */
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
function utcDay(value: string, endOfDay: boolean) {
  if (!value) return undefined;
  const start = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(start)) return undefined;
  return endOfDay ? start + DAY_MS - 1 : start;
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

interface RegisterExportsCardProps {
  organizationId: Id<"organizations">;
}

export function RegisterExportsCard({
  organizationId,
}: RegisterExportsCardProps) {
  const t = useScopedI18n("registerReports");
  const tExport = useScopedI18n("exportJobs");
  const convex = useConvex();
  const [profile, setProfile] = useState<Profile>("accession");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [asOf, setAsOf] = useState("");
  const [preview, setPreview] = useState<{
    key: string;
    result: Preview;
  }>();
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string>();

  const profileLabels: Record<Profile, string> = {
    accession: t("profileAccession"),
    disposal: t("profileDisposal"),
    custody: t("profileCustody"),
    condition: t("profileCondition"),
  };
  const criteria: Criteria = {
    fromDate: utcDay(fromDate, false),
    toDate: utcDay(toDate, true),
    status: STATUS_PROFILES.has(profile) && status ? status : undefined,
    asOf: asOf ? new Date(asOf).getTime() : undefined,
  };
  const source: RegisterSource = { kind: "register", profile, criteria };
  const sourceKey = JSON.stringify(source);
  const criteriaValid =
    (criteria.fromDate === undefined ||
      criteria.toDate === undefined ||
      criteria.fromDate <= criteria.toDate) &&
    (criteria.asOf === undefined || Number.isFinite(criteria.asOf));
  const shownPreview = preview?.key === sourceKey ? preview.result : undefined;

  async function runPreview() {
    if (
      !criteriaValid ||
      (criteria.asOf !== undefined && criteria.asOf > Date.now())
    ) {
      setError(tExport("errorRegisterCriteria"));
      return;
    }
    setPreviewing(true);
    setError(undefined);
    try {
      const result = await convex.query(api.registers.preview, {
        organizationId,
        profile,
        criteria,
      });
      setPreview({ key: sourceKey, result });
    } catch (e) {
      setError(tExport(exportJobErrorKey(e)));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookText className="h-4 w-4" />
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
                if (isProfile(e.target.value)) setProfile(e.target.value);
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-2"
            >
              {PROFILES.map((id) => (
                <option key={id} value={id}>
                  {profileLabels[id]}
                </option>
              ))}
              <option value="spectrum" disabled>
                {t("profileSpectrum")}
              </option>
              <option value="lido" disabled>
                {t("profileLido")}
              </option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="register-from">{t("fromDate")}</Label>
            <Input
              id="register-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="register-to">{t("toDate")}</Label>
            <Input
              id="register-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="register-status">{t("status")}</Label>
            <select
              id="register-status"
              value={STATUS_PROFILES.has(profile) ? status : ""}
              disabled={!STATUS_PROFILES.has(profile)}
              onChange={(e) =>
                setStatus(isStatus(e.target.value) ? e.target.value : "")
              }
              className="h-9 w-full rounded-md border border-input bg-background px-2 disabled:opacity-50"
            >
              <option value="">{t("statusAny")}</option>
              <option value="pending">{t("statusPending")}</option>
              <option value="approved">{t("statusApproved")}</option>
              <option value="rejected">{t("statusRejected")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="register-as-of">{t("asOf")}</Label>
            <Input
              id="register-as-of"
              type="datetime-local"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("asOfHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={previewing}
            onClick={() => void runPreview()}
          >
            {previewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
          </section>
        )}
        {criteriaValid ? (
          <ExportJobControl
            key={sourceKey}
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
