"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useAction, useMutation, useQuery } from "convex/react";
import { type FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import { useScopedI18n } from "@/locales/client";

const emailSchema = z.string().trim().max(254).email();
const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .refine((value) => {
    if (value === "") return true;
    const digits = value.replace(/\D/g, "");
    return (
      /^\+?[0-9 ()-]{7,32}$/.test(value) &&
      digits.length >= 7 &&
      digits.length <= 15
    );
  });
const passwordSchema = z.string().min(8).max(1024);

type EmailState = { kind: "idle" } | { kind: "changed" };
type EmailError =
  | "generic"
  | "invalidEmail"
  | "emailInUse"
  | "emailUnchanged"
  | "throttled"
  | "invalidCode"
  | "expired"
  | "noPending"
  | "support"
  | null;

function getEmailError(code: string): Exclude<EmailError, null> {
  switch (code) {
    case "INVALID_EMAIL":
      return "invalidEmail";
    case "EMAIL_IN_USE":
      return "emailInUse";
    case "EMAIL_UNCHANGED":
      return "emailUnchanged";
    case "EMAIL_SEND_THROTTLED":
      return "throttled";
    case "INVALID_CODE":
      return "invalidCode";
    case "EMAIL_CODE_EXPIRED":
      return "expired";
    case "NO_PENDING_EMAIL_CHANGE":
      return "noPending";
    case "MULTIPLE_EMAIL_ACCOUNTS":
      return "support";
    default:
      return "generic";
  }
}

export function AccountCredentials() {
  const t = useScopedI18n("account");
  const user = useQuery(api.users.getUser);
  const capabilities = useQuery(api.users.getAccountCapabilities);
  const updatePhone = useMutation(api.users.updatePhone);
  const requestEmailChange = useAction(api.accountActions.requestEmailChange);
  const confirmEmailChange = useAction(api.accountActions.confirmEmailChange);
  const cancelEmailChange = useMutation(api.users.cancelEmailChange);
  const changePassword = useAction(api.accountActions.changePassword);

  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailState, setEmailState] = useState<EmailState>({ kind: "idle" });
  const [emailError, setEmailError] = useState<EmailError>(null);
  const [dismissPendingEmail, setDismissPendingEmail] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<
    "saved" | "invalid" | "error" | null
  >(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const phoneValue = phone ?? user?.phone ?? "";
  const pendingEmailChange = dismissPendingEmail
    ? null
    : (capabilities?.pendingEmailChange ?? null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const timer = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleRequestEmailChange = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setEmailError("invalidEmail");
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    setEmailState({ kind: "idle" });
    setVerificationCode("");
    try {
      const result = await requestEmailChange({ newEmail: parsedEmail.data });
      if (result.status === "sent") {
        setEmailState({ kind: "idle" });
        setDismissPendingEmail(false);
      } else {
        setEmailError(getEmailError(result.code));
      }
    } catch {
      setEmailError("generic");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleConfirmEmailChange = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (verificationCode.trim().length !== 8 || !pendingEmailChange) {
      setEmailError("invalidCode");
      return;
    }
    setEmailBusy(true);
    try {
      const result = await confirmEmailChange({
        code: verificationCode.trim(),
      });
      if (result.status === "changed") {
        setEmailState({ kind: "changed" });
        setEmailError(null);
        setEmail("");
        setVerificationCode("");
      } else {
        const error = getEmailError(result.code);
        setEmailError(error);
        if (error === "expired" || error === "noPending") {
          setDismissPendingEmail(true);
          setVerificationCode("");
        }
      }
    } catch {
      setEmailError("generic");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleResendEmailCode = async () => {
    if (!pendingEmailChange) return;
    setEmailBusy(true);
    setEmailError(null);
    try {
      const result = await requestEmailChange({
        newEmail: pendingEmailChange.email,
      });
      if (result.status === "error") {
        setEmailError(getEmailError(result.code));
      }
    } catch {
      setEmailError("generic");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setEmailBusy(true);
    setEmailError(null);
    try {
      const result = await cancelEmailChange({});
      if (result.status === "cancelled") {
        setEmailState({ kind: "idle" });
        setDismissPendingEmail(true);
        setVerificationCode("");
      } else {
        setEmailError("generic");
      }
    } catch {
      setEmailError("generic");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleUpdatePhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedPhone = phoneSchema.safeParse(phoneValue);
    if (!parsedPhone.success) {
      setPhoneMessage("invalid");
      return;
    }
    setPhoneBusy(true);
    setPhoneMessage(null);
    try {
      const result = await updatePhone({ phone: parsedPhone.data });
      if (result.status === "saved") {
        setPhone(parsedPhone.data);
        setPhoneMessage("saved");
      } else {
        setPhoneMessage(result.code === "INVALID_PHONE" ? "invalid" : "error");
      }
    } catch {
      setPhoneMessage("error");
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t("password.mismatch"));
      return;
    }
    const parsedPassword = passwordSchema.safeParse(newPassword);
    if (!parsedPassword.success) {
      setPasswordMessage(t("password.tooShort"));
      return;
    }
    if (!currentPassword) {
      setPasswordMessage(t("password.invalidCurrent"));
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword: parsedPassword.data,
      });
      if (result.status === "error") {
        if (result.code === "PASSWORD_UNCHANGED") {
          setPasswordMessage(t("password.unchanged"));
        } else if (result.code === "INVALID_NEW_PASSWORD") {
          setPasswordMessage(t("password.tooShort"));
        } else if (result.code === "PASSWORD_RATE_LIMITED") {
          setPasswordMessage(t("password.rateLimited"));
        } else if (result.code === "PASSWORD_UNAVAILABLE") {
          setPasswordMessage(t("password.unavailable"));
        } else {
          setPasswordMessage(t("password.error"));
        }
      } else if (result.status === "changed") {
        setPasswordMessage(t("password.changed"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else if (result.status === "password_unavailable") {
        setPasswordMessage(t("password.unavailable"));
      } else {
        setPasswordMessage(t("password.invalidCurrent"));
      }
    } catch {
      setPasswordMessage(t("password.error"));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <section className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium text-foreground">
              {t("email.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("email.description")}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("email.current", { email: user?.email ?? "" })}
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleRequestEmailChange}
          >
            <label
              htmlFor="account-new-email"
              className="flex max-w-md flex-col gap-2 text-sm font-medium"
            >
              {t("email.label")}
              <Input
                id="account-new-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <div>
              <Button type="submit" size="sm" disabled={emailBusy}>
                {emailBusy ? t("email.sending") : t("email.save")}
              </Button>
            </div>
          </form>
          {pendingEmailChange && (
            <form
              className="flex flex-col gap-4"
              onSubmit={handleConfirmEmailChange}
            >
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {t("email.pending", { email: pendingEmailChange.email })}
              </p>
              <label
                htmlFor="account-email-code"
                className="flex max-w-md flex-col gap-2 text-sm font-medium"
              >
                {t("email.codeLabel")}
                <Input
                  id="account-email-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  required
                  value={verificationCode}
                  onChange={(event) =>
                    setVerificationCode(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
              <div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={emailBusy}>
                    {emailBusy ? t("email.verifying") : t("email.verify")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={emailBusy || now < pendingEmailChange.resendAt}
                    onClick={() => void handleResendEmailCode()}
                  >
                    {now < pendingEmailChange.resendAt
                      ? t("email.resendIn", {
                          seconds: Math.ceil(
                            (pendingEmailChange.resendAt - now) / 1000,
                          ),
                        })
                      : t("email.resend")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={emailBusy}
                    onClick={() => void handleCancelEmailChange()}
                  >
                    {t("email.cancel")}
                  </Button>
                </div>
              </div>
            </form>
          )}
          {emailState.kind === "changed" && (
            <p className="text-sm text-emerald-600" role="status">
              {t("email.changed")}
            </p>
          )}
          {emailError && (
            <p className="text-sm text-destructive" role="alert">
              {emailError === "generic"
                ? t("email.error")
                : emailError === "support"
                  ? t("email.supportError")
                  : t(`email.${emailError}`)}
            </p>
          )}
        </div>
      </section>

      <section className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium text-foreground">
              {t("phone.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("phone.description")}
            </p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={handleUpdatePhone}>
            <label
              htmlFor="account-phone"
              className="flex max-w-md flex-col gap-2 text-sm font-medium"
            >
              {t("phone.label")}
              <Input
                id="account-phone"
                type="tel"
                autoComplete="tel"
                value={phoneValue}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setPhoneMessage(null);
                }}
              />
            </label>
            <div>
              <Button type="submit" size="sm" disabled={phoneBusy}>
                {phoneBusy ? t("phone.saving") : t("phone.save")}
              </Button>
            </div>
          </form>
          {phoneMessage === "saved" && (
            <p className="text-sm text-emerald-600" role="status">
              {t("phone.saved")}
            </p>
          )}
          {phoneMessage === "invalid" && (
            <p className="text-sm text-destructive" role="alert">
              {t("phone.invalid")}
            </p>
          )}
          {phoneMessage === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {t("phone.error")}
            </p>
          )}
        </div>
      </section>

      <section className="flex w-full flex-col rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium text-foreground">
              {t("password.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("password.description")}
            </p>
          </div>
          {capabilities === undefined ? (
            <div className="h-9 max-w-md animate-pulse rounded-md bg-muted" />
          ) : capabilities.hasPassword ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={handleChangePassword}
            >
              <label
                htmlFor="account-current-password"
                className="flex max-w-md flex-col gap-2 text-sm font-medium"
              >
                {t("password.currentLabel")}
                <Input
                  id="account-current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label
                htmlFor="account-new-password"
                className="flex max-w-md flex-col gap-2 text-sm font-medium"
              >
                {t("password.newLabel")}
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={1024}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label
                htmlFor="account-confirm-password"
                className="flex max-w-md flex-col gap-2 text-sm font-medium"
              >
                {t("password.confirmLabel")}
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={1024}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <div>
                <Button type="submit" size="sm" disabled={passwordBusy}>
                  {passwordBusy ? t("password.saving") : t("password.save")}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("password.oauthOnly")}
            </p>
          )}
          {passwordMessage && (
            <p
              className={`text-sm ${passwordMessage === t("password.changed") ? "text-emerald-600" : "text-destructive"}`}
              role={
                passwordMessage === t("password.changed") ? "status" : "alert"
              }
            >
              {passwordMessage}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
