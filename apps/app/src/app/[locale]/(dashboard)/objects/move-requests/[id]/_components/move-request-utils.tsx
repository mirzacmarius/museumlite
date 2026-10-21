import type { TransferStage } from "@v1/backend/convex/utils/transferStages";
import { Badge } from "@v1/ui/badge";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { TRANSFER_STAGE_LABELS } from "@/components/transfer-stage";
import { useI18n } from "@/locales/client";

const STAGE_BADGES: Record<
  TransferStage,
  { className?: string; secondary?: true; icon: typeof Clock }
> = {
  waiting_for_sender: {
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/10",
    icon: Clock,
  },
  waiting_for_receiver: {
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/10",
    icon: Clock,
  },
  received: {
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10",
    icon: CheckCircle,
  },
  declined: {
    className:
      "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/10",
    icon: XCircle,
  },
  cancelled: { secondary: true, icon: XCircle },
};

/** The transfer's stage, named as the Transfers board names it. */
export function TransferStageBadge({ stage }: { stage: TransferStage }) {
  const tRoot = useI18n();
  const { className, secondary, icon: Icon } = STAGE_BADGES[stage];
  return (
    <Badge variant={secondary ? "secondary" : undefined} className={className}>
      <Icon className="mr-1 size-3" />
      {tRoot(TRANSFER_STAGE_LABELS[stage])}
    </Badge>
  );
}
