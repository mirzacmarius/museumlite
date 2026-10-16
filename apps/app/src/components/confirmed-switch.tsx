"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Switch } from "@v1/ui/switch";
import { cn } from "@v1/ui/utils";
import { Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useI18n } from "@/locales/client";

interface ConfirmedSwitchProps {
  checked: boolean;
  /** Names the setting in the confirmation, and the switch when there is no `labelId`. */
  settingName: string;
  /** Runs once the change is confirmed; the switch shows it is busy while a returned promise is pending. */
  onConfirmedChange: (checked: boolean) => void | Promise<void>;
  disabled?: boolean;
  id?: string;
  /** The visible setting name. It names the switch for assistive technology but is not a click target. */
  labelId?: string;
  descriptionId?: string;
  /** The switch edits a form, so the confirmation says the change takes effect on save. */
  appliesOnSave?: boolean;
  /** Follows the confirmation when enabling has consequences worth stating. */
  enableDetails?: string;
  /** Follows the confirmation when disabling has consequences worth stating. */
  disableDetails?: string;
}

/**
 * An Administration switch. Turning it on or off, by pointer or keyboard,
 * asks for confirmation first, and nothing changes until it is confirmed.
 */
export function ConfirmedSwitch({
  checked,
  settingName,
  onConfirmedChange,
  disabled,
  id,
  labelId,
  descriptionId,
  appliesOnSave,
  enableDetails,
  disableDetails,
}: ConfirmedSwitchProps) {
  const translate = useI18n();
  const switchRef = useRef<HTMLButtonElement>(null);
  const [request, setRequest] = useState({ open: false, checked });
  const [isApplying, setIsApplying] = useState(false);

  const applyRequest = async () => {
    const result = onConfirmedChange(request.checked);
    if (!(result instanceof Promise)) return;
    setIsApplying(true);
    try {
      await result;
    } finally {
      setIsApplying(false);
    }
  };

  const enabling = request.checked;
  const details = enabling ? enableDetails : disableDetails;

  return (
    <>
      <span className="inline-flex shrink-0 items-center gap-2">
        {isApplying ? (
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin text-muted-foreground"
          />
        ) : null}
        <Switch
          ref={switchRef}
          id={id}
          checked={checked}
          disabled={disabled}
          aria-label={labelId ? undefined : settingName}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          aria-busy={isApplying || undefined}
          onCheckedChange={(next) => {
            if (isApplying) return;
            setRequest({ open: true, checked: next });
          }}
        />
      </span>
      <AlertDialog
        open={request.open}
        onOpenChange={(open) => setRequest((current) => ({ ...current, open }))}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            const control = switchRef.current;
            if (!control?.isConnected) return;
            event.preventDefault();
            control.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {enabling
                ? translate("confirmedSwitch.enableTitle")
                : translate("confirmedSwitch.disableTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {translate("confirmedSwitch.setting", {
                    setting: settingName,
                  })}
                </p>
                {details ? <p>{details}</p> : null}
                {appliesOnSave ? (
                  <p>{translate("confirmedSwitch.appliesOnSave")}</p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translate("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // The dialog stays clickable while it animates closed.
                if (!request.open || isApplying) return;
                void applyRequest();
              }}
            >
              {enabling
                ? translate("confirmedSwitch.enable")
                : translate("confirmedSwitch.disable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ConfirmedSwitchRowProps
  extends Omit<
    ConfirmedSwitchProps,
    "settingName" | "labelId" | "descriptionId"
  > {
  label: string;
  description: string;
  className?: string;
  descriptionClassName?: string;
}

/**
 * A setting's name and description beside its confirmed switch. The text
 * names and describes the switch, but only the switch itself toggles.
 */
export function ConfirmedSwitchRow({
  label,
  description,
  className,
  descriptionClassName,
  ...switchProps
}: ConfirmedSwitchRowProps) {
  const textId = useId();
  const labelId = `${textId}-label`;
  const descriptionId = `${textId}-description`;
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="space-y-1">
        <p id={labelId} className="text-sm leading-none font-medium">
          {label}
        </p>
        <p
          id={descriptionId}
          className={cn("text-sm text-muted-foreground", descriptionClassName)}
        >
          {description}
        </p>
      </div>
      <ConfirmedSwitch
        {...switchProps}
        settingName={label}
        labelId={labelId}
        descriptionId={descriptionId}
      />
    </div>
  );
}
