"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useAction } from "convex/react";
import { useState } from "react";
import { SectionLabel } from "./section-label";

export function ContactForm() {
  const submitTourRequest = useAction(api.web.submitTourRequest);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="border border-gold/40 bg-card p-12 text-center">
        <div className="font-display text-4xl text-gold mb-4">Received.</div>
        <p className="text-muted-foreground">
          We will be in touch within two business days to arrange your
          walkthrough.
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
          await submitTourRequest({
            name: String(formData.get("name") ?? ""),
            institution: String(formData.get("institution") ?? ""),
            email: String(formData.get("email") ?? ""),
            collectionSize: String(formData.get("size") ?? "") || undefined,
            message: String(formData.get("message") ?? "") || undefined,
          });
          setSent(true);
        } catch (submitError) {
          setError(
            submitError instanceof Error
              ? submitError.message
              : "Something went wrong. Please try again.",
          );
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <SectionLabel index="✦" title="Tell us a little" />
      <Field label="Your name" name="name" />
      <Field label="Institution" name="institution" />
      <Field label="Email" name="email" type="email" />
      <Field
        label="Approximate collection size"
        name="size"
        placeholder="e.g. 12,000 objects"
      />
      <div>
        <label
          htmlFor="message"
          id="message-label"
          className="block text-[10px] uppercase tracking-[0.3em] text-gold mb-3"
        >
          Anything you&apos;d like us to know
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
        {isSubmitting ? "Sending…" : "Request a private tour"}
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
