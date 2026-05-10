"use client";

export function ObjectCatalogSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="flex h-full flex-col">
        <div className="z-20 flex flex-col border-b border-border bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="h-6 w-28 rounded bg-muted/60" />
              <div className="h-4 w-px bg-border" />
              <div className="h-8 w-64 rounded-md bg-muted/60" />
              <div className="h-8 w-24 rounded-md bg-muted/60" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-16 rounded-md bg-muted/60" />
              <div className="h-8 w-24 rounded-md bg-muted/60" />
              <div className="h-8 w-28 rounded-md bg-muted/60" />
            </div>
          </div>
        </div>

        <ObjectCatalogTableSkeleton />
      </div>
    </div>
  );
}

export function ObjectCatalogTableSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="custom-scrollbar relative flex-1 overflow-y-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10 bg-background/95 shadow-sm backdrop-blur-md">
            <tr>
              <th className="w-10 border-b border-border px-4 py-3">
                <div className="h-4 w-4 rounded bg-muted/60" />
              </th>
              <th className="w-16 border-b border-border px-4 py-3 font-medium text-muted-foreground">
                Image
              </th>
              <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                Object ID & Description
              </th>
              <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                Collection
              </th>
              <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                Location
              </th>
              <th className="border-b border-border px-4 py-3 font-medium text-muted-foreground">
                Date Acquired
              </th>
              <th className="border-b border-border px-4 py-3 text-right font-medium text-muted-foreground">
                Status
              </th>
              <th className="w-10 border-b border-border px-4 py-3 font-medium text-muted-foreground" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {["row-1", "row-2", "row-3", "row-4", "row-5", "row-6"].map(
              (rowId) => (
                <tr key={rowId}>
                  <td className="px-4 py-3">
                    <div className="h-4 w-4 rounded bg-muted/60" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-10 w-10 rounded-lg bg-muted/60" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <div className="h-4 w-36 rounded bg-muted/60" />
                      <div className="h-3 w-56 rounded bg-muted/40" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-24 rounded bg-muted/50" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-28 rounded bg-muted/50" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3 w-20 rounded bg-muted/50" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="ml-auto h-6 w-16 rounded-full bg-muted/50" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-8 w-8 rounded-md bg-muted/40" />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-6 py-3">
        <div className="h-4 w-24 rounded bg-muted/50" />
      </div>
    </div>
  );
}

export default function ObjectsLoading() {
  return <ObjectCatalogSkeleton />;
}
