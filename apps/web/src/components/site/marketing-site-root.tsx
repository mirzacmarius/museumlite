export function MarketingSiteRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-site-root min-h-screen bg-background text-foreground antialiased">
      {children}
    </div>
  );
}
