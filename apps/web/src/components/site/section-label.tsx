import type { ReactNode } from "react";

export function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-6 text-[10px] uppercase tracking-[0.4em] text-gold/80">
      <span className="font-display text-base text-gold normal-case tracking-normal">
        {index}
      </span>
      <span className="h-px w-16 bg-gold/40" />
      <span>{title}</span>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
}) {
  return (
    <section className="relative pt-40 pb-20 border-b border-border overflow-hidden">
      <div className="absolute inset-0 bg-spotlight opacity-70" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 grid md:grid-cols-12 gap-10 items-end">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.4em] text-gold mb-8">
            <span className="h-px w-10 bg-gold/60" />
            {eyebrow}
          </div>
          <h1 className="font-display text-6xl md:text-8xl leading-[0.92] text-ivory text-balance">
            {title}
          </h1>
        </div>
        {lede && (
          <p className="md:col-span-5 text-lg text-ivory/70 leading-relaxed md:pb-3">
            {lede}
          </p>
        )}
      </div>
    </section>
  );
}
