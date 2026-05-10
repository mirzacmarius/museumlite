export function MediaGridSkeleton() {
  return (
    <div className="flex-1 overflow-hidden rounded-lg border border-border bg-muted/20">
      <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 24 }, (_, i) => `media-tile-${i}`).map((key) => (
          <div
            key={key}
            className="aspect-square rounded-lg border border-border bg-muted/40"
          />
        ))}
      </div>
    </div>
  );
}
