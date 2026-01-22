import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check-insurance-expiry",
  { hours: 24 },
  internal.insurance.checkExpiringPoliciesInternal,
);

crons.interval(
  "check-missing-coverage",
  { hours: 24 },
  internal.insurance.checkMissingCoverageInternal,
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

export default crons;
