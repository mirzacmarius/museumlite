import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check-insurance-expiry",
  { hours: 24 },
  internal.insurance.checkExpiringPoliciesInternal,
);

crons.interval(
  "check-upcoming-deliveries",
  { hours: 24 },
  internal.transit.checkUpcomingDeliveriesInternal,
);

crons.interval(
  "check-delayed-transits",
  { hours: 12 },
  internal.transit.checkDelayedTransitsInternal,
);

crons.interval(
  "check-overdue-treatments",
  { hours: 24 },
  internal.conservationTreatments.checkOverdueTreatmentsInternal,
);

crons.interval(
  "check-assessments-due",
  { hours: 24 },
  internal.conservationTreatments.checkAssessmentsDueInternal,
);

// Loan return reminders - check daily for loans due soon or overdue
crons.interval(
  "check-loan-reminders",
  { hours: 24 },
  internal.loans.checkLoanRemindersInternal,
);

// SLA breach detection - check twice daily for workflow items exceeding SLA
crons.interval(
  "check-sla-breaches",
  { hours: 12 },
  internal.workflowSla.checkAllOrganizationsSla,
);

crons.interval(
  "process-organization-deletions",
  { hours: 24 },
  internal.organizationDeletion.processOrganizationDeletionsInternal,
  {},
);

crons.interval(
  "expire-library-holds",
  { hours: 6 },
  internal.library.holds.expireOldHoldsAllOrgs,
);

crons.interval(
  "process-due-scheduled-reports",
  { minutes: 15 },
  internal.reporting.processDueReports,
);

crons.interval(
  "sweep-webhook-deliveries",
  { minutes: 5 },
  internal.webhookDeliveries.sweep,
  {},
);

crons.interval(
  "sweep-notification-emails",
  { minutes: 5 },
  internal.notificationEmails.sweep,
  {},
);

crons.interval(
  "sweep-reproduction-deliveries",
  { minutes: 5 },
  internal.reproductionDeliveries.sweep,
  {},
);

export default crons;
