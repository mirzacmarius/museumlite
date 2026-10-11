import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import {
  ANALYTICS_SECTION_PERMISSIONS,
  type AnalyticsSection,
} from "../convex/utils/analyticsSections";
import { permissionMissingMessage } from "../convex/utils/capabilities";
import {
  authedForUser,
  capabilityFailureOf,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const ADMINISTRATOR_PERMISSIONS = [
  "organization.manage_settings",
  "organization.view_analytics",
  "collections.read",
  "locations.read",
];

async function administratorWithout(section: AnalyticsSection) {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ADMINISTRATOR_PERMISSIONS.filter(
      (permission) => permission !== ANALYTICS_SECTION_PERMISSIONS[section],
    ),
    { subscriptionTier: "pro" },
  );
  return { member: authedForUser(t, userId), organizationId };
}

type Member = Awaited<ReturnType<typeof administratorWithout>>;

/** Each section's queries as the Analytics page calls them. */
const sectionQueries: Record<
  AnalyticsSection,
  Array<(f: Member) => Promise<unknown>>
> = {
  locationUtilization: [
    ({ member, organizationId }) =>
      member.query(api.dashboard.getLocationUtilization, {
        organizationId,
        now: Date.now(),
      }),
  ],
  scheduledReports: [
    ({ member, organizationId }) =>
      member.query(api.reporting.listScheduledReports, { organizationId }),
    ({ member, organizationId }) =>
      member.query(api.reporting.listReportRuns, { organizationId }),
  ],
};

const SECTIONS = Object.keys(
  ANALYTICS_SECTION_PERMISSIONS,
) as Array<AnalyticsSection>;

describe("Analytics sections for administrators missing a section permission", () => {
  test.each(
    SECTIONS,
  )("without the %s permission, the page still opens and only that section is refused", async (missing) => {
    const f = await administratorWithout(missing);

    const states = await f.member.query(api.capabilities.forOrganization, {
      organizationId: f.organizationId,
    });
    expect(
      states?.find((state) => state.capability === "reporting")?.status,
    ).toBe("available");

    for (const call of sectionQueries[missing]) {
      expect(await capabilityFailureOf(call(f))).toMatchObject({
        reason: "permission_missing",
        message: permissionMissingMessage(
          ANALYTICS_SECTION_PERMISSIONS[missing],
        ),
      });
    }
    for (const section of SECTIONS.filter((other) => other !== missing))
      for (const call of sectionQueries[section]) await call(f);

    await f.member.query(api.dashboard.getOperationalKpis, {
      organizationId: f.organizationId,
      now: Date.now(),
    });
    const preview = await f.member.query(api.registers.preview, {
      organizationId: f.organizationId,
      profile: "accession",
      criteria: {},
      now: Date.now(),
    });
    expect(preview.rows).toEqual([]);
  });
});
