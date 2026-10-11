import { type Infer, v } from "convex/values";

export const NOTIFICATION_CATEGORIES = [
  "approvals",
  "reminders",
  "alerts",
  "assignments",
  "system",
] as const;

export const notificationCategory = v.union(
  v.literal("approvals"),
  v.literal("reminders"),
  v.literal("alerts"),
  v.literal("assignments"),
  v.literal("system"),
);
export type NotificationCategory = Infer<typeof notificationCategory>;

const SLA_WORKFLOW_TYPES = [
  "accession",
  "deaccession",
  "loan",
  "acquisition",
  "exhibition",
  "conservation",
] as const;
export type SlaWorkflowType = (typeof SLA_WORKFLOW_TYPES)[number];

/**
 * Every notification type an emitter may dispatch, with the preference
 * category that controls it. Types only found on older rows are listed so the
 * notification center keeps grouping them.
 */
export const NOTIFICATION_TYPE_CATEGORIES = {
  workflow_pending: "approvals",
  workflow_approved: "approvals",
  workflow_rejected: "approvals",
  workflow_restored: "approvals",
  loan_pending_approval: "approvals",
  loan_approved: "approvals",
  loan_rejected: "approvals",
  accession_pending_approval: "approvals",
  accession_approved: "approvals",
  deaccession_pending_approval: "approvals",
  deaccession_approved: "approvals",
  exhibition_pending_approval: "approvals",
  conservation_pending_approval: "approvals",
  move_request_created: "approvals",
  move_request_approved: "approvals",
  loan_extension_requested: "approvals",
  loan_extension_approved: "approvals",
  loan_extension_rejected: "approvals",
  regulatory_approval_granted: "approvals",
  regulatory_approval_denied: "approvals",

  loan_due_soon: "reminders",
  loan_return_due_soon: "reminders",
  loan_overdue: "reminders",
  insurance_expiring: "reminders",
  insurance_expiry: "reminders",
  license_expiring: "reminders",
  assessment_due: "reminders",
  transit_delivery_reminder: "reminders",
  task_due_soon: "reminders",
  sla_warning_accession: "reminders",
  sla_warning_deaccession: "reminders",
  sla_warning_loan: "reminders",
  sla_warning_acquisition: "reminders",
  sla_warning_exhibition: "reminders",
  sla_warning_conservation: "reminders",

  condition_alert: "alerts",
  environmental_alert: "alerts",
  capacity_alert: "alerts",
  conservation_alert: "alerts",
  transit_delayed: "alerts",
  condition_dispute_created: "alerts",
  condition_dispute_investigating: "alerts",
  condition_dispute_resolved: "alerts",
  insurance_auto_claim: "alerts",
  task_blocked: "alerts",
  library_recall: "alerts",
  sla_breach_accession: "alerts",
  sla_breach_deaccession: "alerts",
  sla_breach_loan: "alerts",
  sla_breach_acquisition: "alerts",
  sla_breach_exhibition: "alerts",
  sla_breach_conservation: "alerts",

  task_assigned: "assignments",
  task_completed: "assignments",
  task_review_requested: "assignments",
  task_returned: "assignments",
  comment_mention: "assignments",

  batch_job_completed: "system",
  report_ready: "system",
  system_announcement: "system",
  loan_dispatched: "system",
  loan_returned: "system",
  loan_partial_return: "system",
  loan_cancelled: "system",
  transit_status_update: "system",
  library_auto_renewal: "system",
} as const satisfies Record<string, NotificationCategory>;

export type NotificationType = keyof typeof NOTIFICATION_TYPE_CATEGORIES;

/** Category of a stored type; unknown legacy types count as system. */
export function categoryOfType(type: string): NotificationCategory {
  return Object.hasOwn(NOTIFICATION_TYPE_CATEGORIES, type)
    ? NOTIFICATION_TYPE_CATEGORIES[type as NotificationType]
    : "system";
}

export function slaNotificationType(
  kind: "warning" | "breach",
  workflowType: SlaWorkflowType,
): NotificationType {
  return `sla_${kind}_${workflowType}`;
}

/**
 * The role permission that reads each kind of entity a notification can
 * name. A recipient without it is not sent the notification. Null means the
 * notification only concerns the recipient (their own borrowing or job).
 */
export const NOTIFICATION_ENTITY_READ_PERMISSIONS = {
  accession: "collections.read",
  deaccession: "collections.read",
  object: "collections.read",
  exhibition: "collections.read",
  conservation: "collections.read",
  conservationTreatment: "collections.read",
  conservationAlert: "collections.read",
  alertEpisode: "locations.read",
  move_request: "collections.read",
  acquisition: "collections.read",
  libraryAcquisitionRequest: "collections.read",
  documentationFinding: "collections.read",
  inventoryException: "locations.read",
  loan: "loans.read",
  transitRecord: "loans.read",
  insurancePolicy: "loans.read",
  insuranceClaim: "loans.read",
  circulation: null,
  batch_job: null,
} as const satisfies Record<string, string | null>;

export type NotificationEntityType =
  keyof typeof NOTIFICATION_ENTITY_READ_PERMISSIONS;

export function readPermissionForEntity(
  entityType: string,
): string | null | undefined {
  return Object.hasOwn(NOTIFICATION_ENTITY_READ_PERMISSIONS, entityType)
    ? NOTIFICATION_ENTITY_READ_PERMISSIONS[entityType as NotificationEntityType]
    : undefined;
}
