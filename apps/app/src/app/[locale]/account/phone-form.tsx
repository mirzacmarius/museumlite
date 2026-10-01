"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { useScopedI18n } from "@/locales/client";
import { phoneSchema } from "./account-credential-validation";

export function PhoneForm() {
  const t = useScopedI18n("account");
  const user = useQuery(api.users.getUser);
  const updatePhone = useMutation(api.users.updatePhone);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<
    "saved" | "invalid" | "error" | null
  >(null);
  const phoneValue = phone ?? user?.phone ?? "";

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

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
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
    </div>
  );
}
