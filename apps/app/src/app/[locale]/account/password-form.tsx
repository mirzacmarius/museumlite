"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useAction, useQuery } from "convex/react";
import { type FormEvent, useReducer } from "react";
import { useScopedI18n } from "@/locales/client";
import { passwordSchema } from "./account-credential-validation";

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordBusy: boolean;
  passwordMessage: string | null;
}

type PasswordFormAction =
  | {
      type: "fieldChanged";
      field: "currentPassword" | "newPassword" | "confirmPassword";
      value: string;
    }
  | { type: "messageChanged"; message: string | null }
  | { type: "submitting" }
  | { type: "finished" }
  | { type: "passwordChanged"; message: string };

const initialPasswordFormState: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  passwordBusy: false,
  passwordMessage: null,
};

function passwordFormReducer(
  state: PasswordFormState,
  action: PasswordFormAction,
): PasswordFormState {
  switch (action.type) {
    case "fieldChanged":
      return { ...state, [action.field]: action.value };
    case "messageChanged":
      return { ...state, passwordMessage: action.message };
    case "submitting":
      return { ...state, passwordBusy: true };
    case "finished":
      return { ...state, passwordBusy: false };
    case "passwordChanged":
      return {
        ...state,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        passwordMessage: action.message,
      };
  }
}

export function PasswordForm() {
  const t = useScopedI18n("account");
  const capabilities = useQuery(api.users.getAccountCapabilities);
  const changePassword = useAction(api.accountActions.changePassword);
  const [state, dispatch] = useReducer(
    passwordFormReducer,
    initialPasswordFormState,
  );

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: "messageChanged", message: null });
    if (state.newPassword !== state.confirmPassword) {
      dispatch({ type: "messageChanged", message: t("password.mismatch") });
      return;
    }
    const parsedPassword = passwordSchema.safeParse(state.newPassword);
    if (!parsedPassword.success) {
      dispatch({ type: "messageChanged", message: t("password.tooShort") });
      return;
    }
    if (!state.currentPassword) {
      dispatch({
        type: "messageChanged",
        message: t("password.invalidCurrent"),
      });
      return;
    }
    dispatch({ type: "submitting" });
    try {
      const result = await changePassword({
        currentPassword: state.currentPassword,
        newPassword: parsedPassword.data,
      });
      if (result.status === "error") {
        if (result.code === "PASSWORD_UNCHANGED") {
          dispatch({
            type: "messageChanged",
            message: t("password.unchanged"),
          });
        } else if (result.code === "INVALID_NEW_PASSWORD") {
          dispatch({ type: "messageChanged", message: t("password.tooShort") });
        } else if (result.code === "PASSWORD_RATE_LIMITED") {
          dispatch({
            type: "messageChanged",
            message: t("password.rateLimited"),
          });
        } else if (result.code === "PASSWORD_UNAVAILABLE") {
          dispatch({
            type: "messageChanged",
            message: t("password.unavailable"),
          });
        } else {
          dispatch({ type: "messageChanged", message: t("password.error") });
        }
      } else if (result.status === "changed") {
        dispatch({ type: "passwordChanged", message: t("password.changed") });
      } else if (result.status === "password_unavailable") {
        dispatch({
          type: "messageChanged",
          message: t("password.unavailable"),
        });
      } else {
        dispatch({
          type: "messageChanged",
          message: t("password.invalidCurrent"),
        });
      }
    } catch {
      dispatch({ type: "messageChanged", message: t("password.error") });
    } finally {
      dispatch({ type: "finished" });
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
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
                  value={state.currentPassword}
                  onChange={(event) =>
                    dispatch({
                      type: "fieldChanged",
                      field: "currentPassword",
                      value: event.target.value,
                    })
                  }
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
                  value={state.newPassword}
                  onChange={(event) =>
                    dispatch({
                      type: "fieldChanged",
                      field: "newPassword",
                      value: event.target.value,
                    })
                  }
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
                  value={state.confirmPassword}
                  onChange={(event) =>
                    dispatch({
                      type: "fieldChanged",
                      field: "confirmPassword",
                      value: event.target.value,
                    })
                  }
                />
              </label>
              <div>
                <Button type="submit" size="sm" disabled={state.passwordBusy}>
                  {state.passwordBusy
                    ? t("password.saving")
                    : t("password.save")}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("password.oauthOnly")}
            </p>
          )}
          {state.passwordMessage && (
            <p
              className={`text-sm ${state.passwordMessage === t("password.changed") ? "text-emerald-600" : "text-destructive"}`}
              role={
                state.passwordMessage === t("password.changed")
                  ? "status"
                  : "alert"
              }
            >
              {state.passwordMessage}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
