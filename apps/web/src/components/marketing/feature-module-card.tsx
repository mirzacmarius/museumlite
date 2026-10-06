export type FeatureModule = {
  title: string;
  desc: string;
  items: readonly string[];
};

export function FeatureModuleGrid({
  modules,
}: {
  modules: readonly FeatureModule[];
}) {
  return (
    <div className="feature-module-grid mx-auto max-w-7xl px-6 lg:px-10">
      {modules.map((m) => (
        <FeatureModuleCard key={m.title} module={m} />
      ))}
    </div>
  );
}

export function FeatureModuleCard({
  module,
  className = "",
}: {
  module: FeatureModule;
  className?: string;
}) {
  return (
    <article
      className={`feature-module-card group flex flex-col gap-5 p-8 md:p-10 lg:p-12 ${className}`}
    >
      <div className="space-y-3">
        <h3 className="font-display text-3xl md:text-4xl text-ivory leading-[1.05] group-hover:text-gold transition-colors">
          {module.title}
        </h3>
        <p className="text-soft-foreground leading-relaxed max-w-prose">
          {module.desc}
        </p>
      </div>
      {module.items.length > 0 ? (
        <ul className="mt-auto pt-6 border-t border-gold/20 space-y-3">
          {module.items.map((item) => (
            <li
              key={item}
              className="flex items-baseline gap-3 text-sm text-muted-foreground"
            >
              <span className="text-gold shrink-0 text-[10px]" aria-hidden>
                ✦
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
