"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { DERIVATIVE_SIZES } from "@v1/backend/convex/utils/reproductionRequestValidators";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation } from "convex/react";
import NextImage from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { useReproductionErrorMessage } from "@/hooks/use-reproduction-error-message";
import { useScopedI18n } from "@/locales/client";
import { useRequestDateTime } from "../../_components/request-status";
import type { RequestView } from "./request-view";
import { Section } from "./section";

type DerivativeSize = (typeof DERIVATIVE_SIZES)[number];

export function DerivativeSection({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests");
  const formatDateTime = useRequestDateTime();
  const errorMessage = useReproductionErrorMessage();
  const prepare = useMutation(api.reproductionRequests.prepareDerivative);
  const [size, setSize] = useState<DerivativeSize>(2400);
  const [saving, setSaving] = useState(false);
  const processing = view.derivatives.some(
    (derivative) => derivative.status === "processing",
  );
  const approvedId = view.decision?.approval?.derivativeId;
  const editable =
    view.request.status === "open" &&
    view.commands.canPrepare &&
    view.request.media.available;

  const submit = async () => {
    setSaving(true);
    try {
      await prepare({ requestId: view.request._id, maxDimension: size });
      toast.success(t("derivative.prepared"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      id="derivative-title"
      title={t("derivative.title")}
      description={t("derivative.description")}
    >
      {view.request.media.available && !view.request.media.sourceVerified ? (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          {t("detail.unverifiedSource")}
        </p>
      ) : null}
      {view.derivatives.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("derivative.empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {view.derivatives.map((derivative) => (
            <li
              key={derivative._id}
              className="space-y-2 rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    derivative.status === "ready" ? "secondary" : "outline"
                  }
                >
                  {t(`derivative.statuses.${derivative.status}`)}
                </Badge>
                {derivative._id === approvedId ? (
                  <Badge>{t("decision.copy")}</Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(derivative.createdAt)}
                </span>
              </div>
              {derivative.previewUrl ? (
                <NextImage
                  src={derivative.previewUrl}
                  alt={t("derivative.preview")}
                  width={derivative.width ?? 320}
                  height={derivative.height ?? 240}
                  unoptimized
                  className="h-auto max-h-48 w-auto rounded border border-border object-contain"
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                {derivative.width && derivative.height
                  ? t("derivative.dimensions", {
                      width: derivative.width,
                      height: derivative.height,
                    })
                  : t("derivative.sizeOption", {
                      size: derivative.maxDimension,
                    })}
              </p>
              {derivative.status === "failed" ? (
                <p className="text-xs text-muted-foreground">
                  {t("derivative.failedHint")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="derivative-size">{t("derivative.size")}</Label>
            <Select
              value={String(size)}
              onValueChange={(value) => {
                const next = DERIVATIVE_SIZES.find(
                  (candidate) => String(candidate) === value,
                );
                if (next) setSize(next);
              }}
            >
              <SelectTrigger id="derivative-size" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DERIVATIVE_SIZES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t("derivative.sizeOption", { size: value })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={submit}
            disabled={
              saving || processing || !view.request.media.sourceVerified
            }
          >
            {processing ? t("derivative.preparing") : t("derivative.prepare")}
          </Button>
        </div>
      ) : null}
    </Section>
  );
}
