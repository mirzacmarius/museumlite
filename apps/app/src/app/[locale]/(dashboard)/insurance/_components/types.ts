export const INSURANCE_TABS = [
  "overview",
  "policies",
  "coverages",
  "claims",
  "review",
] as const;

export type InsuranceTab = (typeof INSURANCE_TABS)[number];

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

export const policyTypeOptions: Array<{ value: PolicyType }> = [
  { value: "all" },
  { value: "blanket" },
  { value: "scheduled" },
  { value: "exhibition" },
  { value: "transit" },
  { value: "loan" },
];

export const policyStatusOptions: Array<{ value: PolicyStatus }> = [
  { value: "all" },
  { value: "active" },
  { value: "pending" },
  { value: "expired" },
  { value: "cancelled" },
  { value: "suspended" },
];

export const claimStatusOptions: Array<{ value: ClaimStatus }> = [
  { value: "all" },
  { value: "draft" },
  { value: "submitted" },
  { value: "under_review" },
  { value: "approved" },
  { value: "denied" },
  { value: "settled" },
  { value: "closed" },
  { value: "appealed" },
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
