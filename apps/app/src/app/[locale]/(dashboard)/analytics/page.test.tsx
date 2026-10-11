// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { ANALYTICS_SECTION_PERMISSIONS } from "@v1/backend/convex/utils/analyticsSections";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderOnPage } from "@/testing/render-on-page";
import AnalyticsPage from "./page";

const ADMINISTRATOR_PERMISSIONS = [
  "organization.manage_settings",
  "organization.view_analytics",
  "collections.read",
  "locations.read",
];

const access = vi.hoisted(() => ({ permissions: [] as string[] }));
const calledQueries = vi.hoisted(() => new Set<string>());

/** Queries the member's role cannot run reject, as on the backend. */
const SECTION_QUERY_PERMISSIONS: Record<string, string> = {
  "dashboard:getLocationUtilization":
    ANALYTICS_SECTION_PERMISSIONS.locationUtilization,
  "reporting:listScheduledReports":
    ANALYTICS_SECTION_PERMISSIONS.scheduledReports,
  "reporting:listReportRuns": ANALYTICS_SECTION_PERMISSIONS.scheduledReports,
};

const READY_LOCATIONS = {
  availability: "ready",
  summary: {
    totalLocations: 1,
    locationsWithCapacity: 1,
    totalCapacity: 10,
    totalOccupied: 4,
    utilizationPercentage: 40,
  },
  byType: [],
  byTypeComplete: true,
  topUtilized: [],
  underutilized: [],
  atCapacity: [],
  generatedAt: 0,
};

vi.mock("convex/react", () => ({
  useQuery: (query: never, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(query);
    calledQueries.add(name);
    const permission = SECTION_QUERY_PERMISSIONS[name];
    if (permission && !access.permissions.includes(permission))
      throw new Error(`Permission denied: ${permission}`);
    switch (name) {
      case "dashboard:getOperationalKpis":
        return {
          availability: "ready",
          generatedAt: 0,
          asOf: 0,
          inventory: {},
          loans: {},
          exhibitions: {},
        };
      case "dashboard:getLocationUtilization":
        return READY_LOCATIONS;
      default:
        return undefined;
    }
  },
}));
vi.mock("@/components/organization-provider", () => ({
  useOrganization: () => ({ currentOrganizationId: "org" }),
}));
vi.mock("@/components/permission-gate", () => ({
  usePermissions: () => ({
    isLoading: false,
    hasPermission: (permission: string) =>
      access.permissions.includes(permission),
  }),
}));
vi.mock("@/hooks/use-capabilities", () => ({
  useCapabilities: () => ({
    stateOf: (capability: string) => ({
      capability,
      listed: true,
      status: "available",
    }),
    isAvailable: () => true,
  }),
}));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ hasFeature: () => false, hasModule: () => false }),
}));
vi.mock("@/hooks/use-client-date-format", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useClientNow: () => Date.UTC(2026, 9, 11),
}));

// The cards are stubs; each section's own queries are exercised above.
vi.mock("./_components/inventory-valuation-card", () => ({
  InventoryValuationCard: () => null,
}));
vi.mock("./_components/loan-calendar-card", () => ({
  LoanCalendarCard: () => <section aria-label="Loans" />,
}));
vi.mock("./_components/exhibition-pipeline-card", () => ({
  ExhibitionPipelineCard: () => null,
}));
vi.mock("./_components/location-utilization-card", () => ({
  LocationUtilizationCard: () => <section aria-label="Location utilization" />,
}));
vi.mock("./_components/scheduled-reports-card", async () => {
  const [{ useQuery }, { api }] = await Promise.all([
    import("convex/react"),
    import("@v1/backend/convex/_generated/api"),
  ]);
  return {
    ScheduledReportsCard: ({ organizationId }: { organizationId: string }) => {
      useQuery(api.reporting.listScheduledReports, { organizationId } as never);
      useQuery(api.reporting.listReportRuns, { organizationId } as never);
      return <section aria-label="Scheduled reports" />;
    },
  };
});
vi.mock("./_components/report-exports-card", () => ({
  ReportExportsCard: ({
    reports,
  }: {
    reports: { locationUtilization?: unknown } | null;
  }) => (
    <section aria-label="Report exports">
      {reports
        ? `reports ready; locations ${reports.locationUtilization ? "included" : "omitted"}`
        : "reports unavailable"}
    </section>
  ),
}));
vi.mock("./_components/register-exports-card", () => ({
  RegisterExportsCard: () => <section aria-label="Register exports" />,
}));

beforeEach(() => {
  calledQueries.clear();
});

async function openAnalyticsWithout(permission: string) {
  access.permissions = ADMINISTRATOR_PERMISSIONS.filter(
    (granted) => granted !== permission,
  );
  await renderOnPage(<AnalyticsPage />, "/en/analytics");
  await screen.findByRole("region", { name: "Register exports" });
}

function lockedSection(title: string) {
  const heading = screen.getByRole("heading", { name: `${title} is locked` });
  const status = heading.closest("[role=status]");
  if (!(status instanceof HTMLElement)) throw new Error("No locked state");
  return within(status);
}

test("without locations.read, location utilization is unavailable and the rest of Analytics works", async () => {
  await openAnalyticsWithout(ANALYTICS_SECTION_PERMISSIONS.locationUtilization);

  expect(calledQueries).not.toContain("dashboard:getLocationUtilization");
  expect(
    lockedSection("Location Utilization").getByText(
      /Your role does not include access to this/,
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Location utilization" })).toBe(
    null,
  );
  expect(screen.getByRole("region", { name: "Loans" })).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "Scheduled reports" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "Report exports" }).textContent,
  ).toBe("reports ready; locations omitted");
});

test("without organization.view_analytics, scheduled reports are unavailable and the rest of Analytics works", async () => {
  await openAnalyticsWithout(ANALYTICS_SECTION_PERMISSIONS.scheduledReports);

  expect(calledQueries).not.toContain("reporting:listScheduledReports");
  expect(calledQueries).not.toContain("reporting:listReportRuns");
  expect(
    lockedSection("Scheduled Reports").getByText(
      /Your role does not include access to this/,
    ),
  ).toBeTruthy();
  await screen.findByRole("region", { name: "Location utilization" });
  expect(
    screen.getByRole("region", { name: "Report exports" }).textContent,
  ).toBe("reports ready; locations included");
});
