import { Badge } from "@v1/ui/badge";
import { CheckCircle, Clock, XCircle } from "lucide-react";

export function MoveRequestStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
    case "pending_source_approval":
      return (
        <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
          <Clock className="mr-1 size-3" />
          Pending transfer approval
        </Badge>
      );
    case "approved_for_transfer":
    case "awaiting_acceptance":
      return (
        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/10">
          <Clock className="mr-1 size-3" />
          Awaiting acceptance
        </Badge>
      );
    case "executed":
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
          <CheckCircle className="mr-1 size-3" />
          Executed
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/10">
          <XCircle className="mr-1 size-3" />
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary">
          <XCircle className="mr-1 size-3" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function formatMoveRequestAccessionMode(mode: string) {
  switch (mode) {
    case "keep":
      return "Keep current accession number";
    case "auto":
      return "Generate a new accession number";
    case "manual":
      return "Use the requested accession number";
    default:
      return mode;
  }
}
