export type PolicyStatus =
  | "all"
  | "active"
  | "pending"
  | "expired"
  | "cancelled"
  | "suspended";

export type PolicyType =
  | "all"
  | "blanket"
  | "scheduled"
  | "exhibition"
  | "transit"
  | "loan";

export type ClaimStatus =
  | "all"
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "denied"
  | "settled"
  | "closed"
  | "appealed";

export const policyTypeOptions: Array<{ label: string; value: PolicyType }> = [
  { label: "All types", value: "all" },
  { label: "Blanket", value: "blanket" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Exhibition", value: "exhibition" },
  { label: "Transit", value: "transit" },
  { label: "Loan", value: "loan" },
];

export const policyStatusOptions: Array<{
  label: string;
  value: PolicyStatus;
}> = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Suspended", value: "suspended" },
];

export const claimStatusOptions: Array<{ label: string; value: ClaimStatus }> =
  [
    { label: "All statuses", value: "all" },
    { label: "Draft", value: "draft" },
    { label: "Submitted", value: "submitted" },
    { label: "Under review", value: "under_review" },
    { label: "Approved", value: "approved" },
    { label: "Denied", value: "denied" },
    { label: "Settled", value: "settled" },
    { label: "Closed", value: "closed" },
    { label: "Appealed", value: "appealed" },
  ];

export const policyStatusColor: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  expired: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export const claimStatusColor: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  submitted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  denied: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  settled: "bg-primary/10 text-primary border-primary/20",
  closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  appealed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};
