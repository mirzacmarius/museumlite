"use client";

import type React from "react";

interface EditSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function EditSection({
  title,
  description,
  children,
}: EditSectionProps) {
  return (
    <section className="space-y-5 border-b border-border/60 pb-8 last:border-b-0 last:pb-0">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
