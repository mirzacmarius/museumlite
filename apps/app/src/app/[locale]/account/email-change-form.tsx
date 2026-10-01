"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useAction, useMutation, useQuery } from "convex/react";
import { type FormEvent, useEffect, useReducer } from "react";
import { useScopedI18n } from "@/locales/client";
import {
  type EmailError,
  emailSchema,
  getEmailError,
} from "./account-credential-validation";

type EmailState = { kind: "idle" } | { kind: "changed" };
interface EmailFormState {
  email: string;
  verificationCode: string;
  busy: boolean;
  state: EmailState;
  error: EmailError;
  dismissPending: boolean;
  now: number;
}

type EmailFormAction =
  | { type: "fieldChanged"; field: "email" | "verificationCode"; value: string }
  | { type: "busyChanged"; busy: boolean }
  | { type: "stateChanged"; state: EmailState }
  | { type: "errorChanged"; error: EmailError }
  | { type: "pendingDismissed"; dismissed: boolean }
  | { type: "clockChanged"; now: number };

const initialEmailFormState: EmailFormState = {
  email: "",
  verificationCode: "",
  busy: false,
  state: { kind: "idle" },
  error: null,
  dismissPending: false,
  now: 0,
};

function emailFormReducer(
  state: EmailFormState,
  action: EmailFormAction,
): EmailFormState {
  switch (action.type) {
    case "fieldChanged":
      return { ...state, [action.field]: action.value };
    case "busyChanged":
      return { ...state, busy: action.busy };
    case "stateChanged":
      return { ...state, state: action.state };
    case "errorChanged":
      return { ...state, error: action.error };
    case "pendingDismissed":
      return { ...state, dismissPending: action.dismissed };
    case "clockChanged":
      return { ...state, now: action.now };
  }
}

export function EmailChangeForm() {
  const t = useScopedI18n("account");
  const user = useQuery(api.users.getUser);
  const capabilities = useQuery(api.users.getAccountCapabilities);
  const requestEmailChange = useAction(api.accountActions.requestEmailChange);
  const confirmEmailChange = useAction(api.accountActions.confirmEmailChange);
  const cancelEmailChange = useMutation(api.users.cancelEmailChange);
  const [state, dispatch] = useReducer(emailFormReducer, initialEmailFormState);
  const pendingEmailChange = state.dismissPending
    ? null
    : (capabilities?.pendingEmailChange ?? null);

  useEffect(() => {
    const updateNow = () => dispatch({ type: "clockChanged", now: Date.now() });
    updateNow();
    const timer = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleRequestEmailChange = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const parsedEmail = emailSchema.safeParse(state.email);
    if (!parsedEmail.success) {
      dispatch({ type: "errorChanged", error: "invalidEmail" });
      return;
    }
    dispatch({ type: "busyChanged", busy: true });
    dispatch({ type: "errorChanged", error: null });
    dispatch({ type: "stateChanged", state: { kind: "idle" } });
    dispatch({ type: "fieldChanged", field: "verificationCode", value: "" });
    try {
      const result = await requestEmailChange({ newEmail: parsedEmail.data });
      if (result.status === "sent") {
        dispatch({ type: "stateChanged", state: { kind: "idle" } });
        dispatch({ type: "pendingDismissed", dismissed: false });
      } else {
        dispatch({ type: "errorChanged", error: getEmailError(result.code) });
      }
    } catch {
      dispatch({ type: "errorChanged", error: "generic" });
    } finally {
      dispatch({ type: "busyChanged", busy: false });
    }
  };

  const handleConfirmEmailChange = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (state.verificationCode.trim().length !== 8 || !pendingEmailChange) {
      dispatch({ type: "errorChanged", error: "invalidCode" });
      return;
    }
    dispatch({ type: "busyChanged", busy: true });
    try {
      const result = await confirmEmailChange({
        code: state.verificationCode.trim(),
      });
      if (result.status === "changed") {
        dispatch({ type: "stateChanged", state: { kind: "changed" } });
        dispatch({ type: "errorChanged", error: null });
        dispatch({ type: "fieldChanged", field: "email", value: "" });
        dispatch({
          type: "fieldChanged",
          field: "verificationCode",
          value: "",
        });
      } else {
        const error = getEmailError(result.code);
        dispatch({ type: "errorChanged", error });
        if (error === "expired" || error === "noPending") {
          dispatch({ type: "pendingDismissed", dismissed: true });
          dispatch({
            type: "fieldChanged",
            field: "verificationCode",
            value: "",
          });
        }
      }
    } catch {
      dispatch({ type: "errorChanged", error: "generic" });
    } finally {
      dispatch({ type: "busyChanged", busy: false });
    }
  };

  const handleResendEmailCode = async () => {
    if (!pendingEmailChange) return;
    dispatch({ type: "busyChanged", busy: true });
    dispatch({ type: "errorChanged", error: null });
    try {
      const result = await requestEmailChange({
        newEmail: pendingEmailChange.email,
      });
      if (result.status === "error") {
        dispatch({ type: "errorChanged", error: getEmailError(result.code) });
      }
    } catch {
      dispatch({ type: "errorChanged", error: "generic" });
    } finally {
      dispatch({ type: "busyChanged", busy: false });
    }
  };

  const handleCancelEmailChange = async () => {
    dispatch({ type: "busyChanged", busy: true });
    dispatch({ type: "errorChanged", error: null });
    try {
      const result = await cancelEmailChange({});
      if (result.status === "cancelled") {
        dispatch({ type: "stateChanged", state: { kind: "idle" } });
        dispatch({ type: "pendingDismissed", dismissed: true });
        dispatch({
          type: "fieldChanged",
          field: "verificationCode",
          value: "",
        });
      } else {
        dispatch({ type: "errorChanged", error: "generic" });
      }
    } catch {
      dispatch({ type: "errorChanged", error: "generic" });
    } finally {
      dispatch({ type: "busyChanged", busy: false });
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
                value={state.email}
                onChange={(event) =>
                  dispatch({
                    type: "fieldChanged",
                    field: "email",
                    value: event.target.value,
                  })
                }
              />
            </label>
            <div>
              <Button type="submit" size="sm" disabled={state.busy}>
                {state.busy ? t("email.sending") : t("email.save")}
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
                  value={state.verificationCode}
                  onChange={(event) =>
                    dispatch({
                      type: "fieldChanged",
                      field: "verificationCode",
                      value: event.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </label>
              <div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={state.busy}>
                    {state.busy ? t("email.verifying") : t("email.verify")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      state.busy || state.now < pendingEmailChange.resendAt
                    }
                    onClick={() => void handleResendEmailCode()}
                  >
                    {state.now < pendingEmailChange.resendAt
                      ? t("email.resendIn", {
                          seconds: Math.ceil(
                            (pendingEmailChange.resendAt - state.now) / 1000,
                          ),
                        })
                      : t("email.resend")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={state.busy}
                    onClick={() => void handleCancelEmailChange()}
                  >
                    {t("email.cancel")}
                  </Button>
                </div>
              </div>
            </form>
          )}
          {state.state.kind === "changed" && (
            <p className="text-sm text-emerald-600" role="status">
              {t("email.changed")}
            </p>
          )}
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error === "generic"
                ? t("email.error")
                : state.error === "support"
                  ? t("email.supportError")
                  : t(`email.${state.error}`)}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
