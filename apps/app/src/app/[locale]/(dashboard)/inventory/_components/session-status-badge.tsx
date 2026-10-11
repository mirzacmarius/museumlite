import type { InventorySessionStatus } from "@v1/backend/convex/utils/inventoryValidators";
import { Badge } from "@v1/ui/badge";
import { useScopedI18n } from "@/locales/client";

export function SessionStatusBadge({
  status,
}: {
  status: InventorySessionStatus;
}) {
  const t = useScopedI18n("inventory.statuses");
  return (
    <Badge
      variant={
        status === "reviewing"
          ? "default"
          : status === "scanning"
            ? "secondary"
            : "outline"
      }
    >
      {t(status)}
    </Badge>
  );
}
