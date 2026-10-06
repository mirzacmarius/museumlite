"use client";

import { useState } from "react";
import { submitTourRequest } from "@/app/(marketing)/contact/actions";
import { useWebI18n } from "@/locales/provider";
import { SectionLabel } from "./section-label";

export function ContactForm() {
  const { t } = useWebI18n();
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="border border-gold/40 bg-card p-12 text-center">
        <div className="font-display text-4xl text-gold mb-4">
          {t("marketing.contact.received")}
        </div>
        <p className="text-muted-foreground">
          {t("marketing.contact.followUp")}
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-8"
      action={async (formData) => {
        setError(null);
        setIsSubmitting(true);

        try {
          const result = await submitTourRequest({
            name: String(formData.get("name") ?? ""),
            institution: String(formData.get("institution") ?? ""),
            email: String(formData.get("email") ?? ""),
            collectionSize: String(formData.get("size") ?? "") || undefined,
            message: String(formData.get("message") ?? "") || undefined,
          });

          if (result.ok) {
            setSent(true);
          } else {
            setError(
              result.error === "submission_failed"
                ? t("marketing.contact.genericError")
                : t("marketing.contact.fieldError"),
            );
          }
        } catch {
          setError(t("marketing.contact.genericError"));
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <SectionLabel index="✦" title={t("marketing.contact.tellUs")} />
      <Field label={t("marketing.contact.yourName")} name="name" />
      <Field label={t("marketing.contact.institution")} name="institution" />
      <Field
        label={t("marketing.contact.fieldEmail")}
        name="email"
        type="email"
      />
      <Field
        label={t("marketing.contact.collectionSize")}
        name="size"
        placeholder={t("marketing.contact.collectionSizePlaceholder")}
      />
      <div>
        <label
          htmlFor="message"
          id="message-label"
          className="block text-[10px] uppercase tracking-[0.3em] text-gold mb-3"
        >
          {t("marketing.contact.message")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          aria-labelledby="message-label"
          className="w-full bg-transparent border-b border-border focus:border-gold outline-none text-ivory text-lg py-3 transition-colors resize-none"
        />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-marketing mt-4 bg-gold text-ink px-8 py-4 text-xs uppercase tracking-[0.3em] hover:bg-ivory transition-colors disabled:opacity-60"
      >
        {isSubmitting
          ? t("marketing.contact.sending")
          : t("marketing.contact.submit")}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  const labelId = `${name}-label`;

  return (
    <div>
      <label
        id={labelId}
        className="block text-[10px] uppercase tracking-[0.3em] text-gold mb-3"
        htmlFor={name}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required
        aria-labelledby={labelId}
        className="w-full bg-transparent border-b border-border focus:border-gold outline-none text-ivory text-lg py-3 transition-colors"
      />
    </div>
  );
}
