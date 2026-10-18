import type { ReactNode } from "react";
import { AccessionsWorkbenchHeader } from "../accessions-workbench-header";

export default function AccessionsWorkbenchLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex size-full flex-col bg-background">
      <AccessionsWorkbenchHeader />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
