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

export default crons;
