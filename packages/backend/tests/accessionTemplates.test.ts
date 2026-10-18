import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { accessionFormatErrorFromError } from "../convex/utils/accessionNumberParser";
import {
  authedForUser,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

async function setup() {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(t, [
    "organization.manage_settings",
    "collections.read",
  ]);
  return { organizationId, admin: authedForUser(t, userId) };
}

async function formatRefusalOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return accessionFormatErrorFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

describe("accession template library", () => {
  test("a template in the braced syntax is saved", async () => {
    const { organizationId, admin } = await setup();

    await admin.mutation(api.accessionTemplates.create, {
      organizationId,
      name: "Yearly",
      template: "NAT-{YYYY}-{###}",
    });

    const templates = await admin.query(api.accessionTemplates.list, {
      organizationId,
    });
    expect(templates.map((template) => template.template)).toEqual([
      "NAT-{YYYY}-{###}",
    ]);
  });

  test.each([
    "NAT-YYYY-###",
    "MUS-YYYY-MM-####",
  ])("a new template written with bare tokens, %s, is refused with a coded error", async (format) => {
    const { organizationId, admin } = await setup();

    const refusal = await formatRefusalOf(
      admin.mutation(api.accessionTemplates.create, {
        organizationId,
        name: "Bare",
        template: format,
      }),
    );

    expect(refusal?.issues).toEqual([{ code: "COUNTER_MISSING" }]);
    expect(
      await admin.query(api.accessionTemplates.list, { organizationId }),
    ).toEqual([]);
  });

  test("changing a template to an unknown variable is refused, while renaming it is saved", async () => {
    const { organizationId, admin } = await setup();
    const templateId = await admin.mutation(api.accessionTemplates.create, {
      organizationId,
      name: "Yearly",
      template: "NAT-{YYYY}-{###}",
    });

    const refusal = await formatRefusalOf(
      admin.mutation(api.accessionTemplates.update, {
        templateId,
        template: "NAT-{XYZ}-{###}",
      }),
    );
    await admin.mutation(api.accessionTemplates.update, {
      templateId,
      name: "Yearly numbers",
      template: "NAT-{YYYY}-{###}",
    });

    expect(refusal?.issues).toEqual([
      { code: "UNKNOWN_VARIABLE", variable: "{XYZ}" },
    ]);
    const [template] = await admin.query(api.accessionTemplates.list, {
      organizationId,
    });
    expect(template).toMatchObject({
      name: "Yearly numbers",
      template: "NAT-{YYYY}-{###}",
    });
  });
});
