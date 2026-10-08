import { expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { loanAgreementTemplateErrorFromError } from "../convex/utils/loanAgreementErrors";
import {
  authedForUser,
  type ConvexTest,
  createConvexTest,
  createOrgUserWithPermissions,
} from "./testHarness";

const ADMIN_PERMISSIONS = [
  "organization.manage_settings",
  "loans.read",
  "loans.create",
];

async function createLoanAdmin(t: ConvexTest, organizationName = "Museum") {
  const setup = await createOrgUserWithPermissions(t, ADMIN_PERMISSIONS, {
    organizationName,
    subscriptionTier: "pro",
  });
  return { ...setup, authed: authedForUser(t, setup.userId) };
}

async function templateErrorOf(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return loanAgreementTemplateErrorFromError(error);
  }
  throw new Error("Expected the call to be rejected");
}

const conditionsSection = {
  heading: "Conditions",
  body: "The borrower {{borrower.name}} insures the objects for {{insurance.value}}.",
};

test("an administrator creates a loan agreement template and reads it back", async () => {
  const t = createConvexTest();
  const { authed, organizationId } = await createLoanAdmin(t);

  const templateId = await authed.mutation(api.loanAgreementTemplates.create, {
    organizationId,
    name: "Outgoing standard",
    language: "en",
    loanType: "outgoing",
    sections: [conditionsSection],
  });

  const template = await authed.query(api.loanAgreementTemplates.get, {
    organizationId,
    templateId,
  });
  expect(template).toMatchObject({
    name: "Outgoing standard",
    language: "en",
    loanType: "outgoing",
    status: "active",
    isDefault: false,
    sections: [conditionsSection],
  });
});

async function createTemplate(
  admin: Awaited<ReturnType<typeof createLoanAdmin>>,
  overrides: Partial<{
    name: string;
    loanType: "any" | "incoming" | "outgoing";
  }> = {},
) {
  return await admin.authed.mutation(api.loanAgreementTemplates.create, {
    organizationId: admin.organizationId,
    name: overrides.name ?? "Standard",
    language: "en",
    loanType: overrides.loanType ?? "any",
    sections: [conditionsSection],
  });
}

async function createLoan(
  admin: Awaited<ReturnType<typeof createLoanAdmin>>,
  type: "incoming" | "outgoing",
) {
  return await admin.authed.mutation(api.loans.create, {
    organizationId: admin.organizationId,
    type,
    lenderBorrowerName: "Partner Museum",
    startDate: Date.UTC(2026, 0, 15),
  });
}

test("a loan records the currency of its insurance value", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);

  const loanId = await admin.authed.mutation(api.loans.create, {
    organizationId: admin.organizationId,
    type: "outgoing",
    lenderBorrowerName: "Partner Museum",
    startDate: Date.UTC(2026, 0, 15),
    insuranceValue: 125000,
    currency: " nok ",
  });

  const loan = await admin.authed.query(api.loans.get, { loanId });
  expect(loan?.currency).toBe("NOK");
});

test("a loan currency must be a three-letter ISO code", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);

  const error = await templateErrorOf(
    admin.authed.mutation(api.loans.create, {
      organizationId: admin.organizationId,
      type: "outgoing",
      lenderBorrowerName: "Partner Museum",
      startDate: Date.UTC(2026, 0, 15),
      currency: "Euro",
    }),
  );

  expect(error?.code).toBe("INVALID_CURRENCY");
});

test("editing a pending loan can change its currency", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [...ADMIN_PERMISSIONS, "loans.update"],
    { subscriptionTier: "pro" },
  );
  const authed = authedForUser(t, userId);
  const loanId = await authed.mutation(api.loans.create, {
    organizationId,
    type: "incoming",
    lenderBorrowerName: "Partner Museum",
    startDate: Date.UTC(2026, 0, 15),
    currency: "USD",
  });

  await authed.mutation(api.loans.update, { loanId, currency: "eur" });

  const loan = await authed.query(api.loans.get, { loanId });
  expect(loan?.currency).toBe("EUR");
});

test("another organization cannot read a template through its own organization", async () => {
  const t = createConvexTest();
  const owner = await createLoanAdmin(t, "Owner Museum");
  const outsider = await createLoanAdmin(t, "Outsider Museum");
  const templateId = await createTemplate(owner);

  const result = await outsider.authed.query(api.loanAgreementTemplates.get, {
    organizationId: outsider.organizationId,
    templateId,
  });

  expect(result).toBeNull();
});

test("staff without organization.manage_settings cannot create templates", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ["loans.read", "loans.update"],
    { subscriptionTier: "pro" },
  );

  await expect(
    authedForUser(t, userId).mutation(api.loanAgreementTemplates.create, {
      organizationId,
      name: "Unauthorized",
      language: "en",
      loanType: "any",
      sections: [conditionsSection],
    }),
  ).rejects.toThrow("Permission denied: organization.manage_settings");
});

test("staff without loans.read cannot read templates", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const templateId = await createTemplate(admin);
  const cataloger = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Cataloger" });
    const roleId = await ctx.db.insert("roles", {
      organizationId: admin.organizationId,
      name: "Cataloger",
      isSystemRole: false,
    });
    await ctx.db.insert("userOrganizations", {
      userId,
      organizationId: admin.organizationId,
      roleId,
      joinedAt: Date.now(),
    });
    return userId;
  });

  await expect(
    authedForUser(t, cataloger).query(api.loanAgreementTemplates.get, {
      organizationId: admin.organizationId,
      templateId,
    }),
  ).rejects.toThrow("Permission denied: loans.read");
});

test("saving a template with an unknown placeholder is rejected with a coded error", async () => {
  const t = createConvexTest();
  const { authed, organizationId } = await createLoanAdmin(t);

  const error = await templateErrorOf(
    authed.mutation(api.loanAgreementTemplates.create, {
      organizationId,
      name: "Typo",
      language: "en",
      loanType: "any",
      sections: [{ heading: "Parties", body: "Lender: {{lender.nmae}}" }],
    }),
  );

  expect(error).toMatchObject({
    code: "UNKNOWN_PLACEHOLDER",
    placeholder: "lender.nmae",
  });
});

test("saving a template with an unclosed placeholder is rejected with a coded error", async () => {
  const t = createConvexTest();
  const { authed, organizationId } = await createLoanAdmin(t);

  const error = await templateErrorOf(
    authed.mutation(api.loanAgreementTemplates.create, {
      organizationId,
      name: "Unclosed",
      language: "en",
      loanType: "any",
      sections: [{ heading: "Period", body: "Starts {{loan.startDate" }],
    }),
  );

  expect(error?.code).toBe("MALFORMED_PLACEHOLDER");
});

test("a template needs a name", async () => {
  const t = createConvexTest();
  const { authed, organizationId } = await createLoanAdmin(t);

  const error = await templateErrorOf(
    authed.mutation(api.loanAgreementTemplates.create, {
      organizationId,
      name: "   ",
      language: "en",
      loanType: "any",
      sections: [conditionsSection],
    }),
  );

  expect(error?.code).toBe("NAME_REQUIRED");
});

test("a template needs at least one section and no blank section text", async () => {
  const t = createConvexTest();
  const { authed, organizationId } = await createLoanAdmin(t);
  const attempt = (sections: Array<{ heading: string; body: string }>) =>
    templateErrorOf(
      authed.mutation(api.loanAgreementTemplates.create, {
        organizationId,
        name: "Empty",
        language: "en",
        loanType: "any",
        sections,
      }),
    );

  expect((await attempt([]))?.code).toBe("SECTIONS_REQUIRED");
  expect((await attempt([{ heading: "Heading", body: "  " }]))?.code).toBe(
    "SECTIONS_REQUIRED",
  );
});

test("template size is bounded", async () => {
  const t = createConvexTest();
  const { authed, organizationId } = await createLoanAdmin(t);

  const error = await templateErrorOf(
    authed.mutation(api.loanAgreementTemplates.create, {
      organizationId,
      name: "Huge",
      language: "en",
      loanType: "any",
      sections: [{ heading: "Clause", body: "x".repeat(20_001) }],
    }),
  );

  expect(error?.code).toBe("TEMPLATE_TOO_LARGE");
});

test("an administrator edits a template's content", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const templateId = await createTemplate(admin);
  const revised = {
    heading: "Insurance",
    body: "Wall-to-wall cover of {{insurance.value}} ({{loan.currency}}).",
  };

  await admin.authed.mutation(api.loanAgreementTemplates.update, {
    organizationId: admin.organizationId,
    templateId,
    name: "Standard (revised)",
    language: "no",
    loanType: "incoming",
    sections: [revised],
  });

  const template = await admin.authed.query(api.loanAgreementTemplates.get, {
    organizationId: admin.organizationId,
    templateId,
  });
  expect(template).toMatchObject({
    name: "Standard (revised)",
    language: "no",
    loanType: "incoming",
    sections: [revised],
  });
});

test("edits are validated like new templates", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const templateId = await createTemplate(admin);

  const error = await templateErrorOf(
    admin.authed.mutation(api.loanAgreementTemplates.update, {
      organizationId: admin.organizationId,
      templateId,
      name: "Standard",
      language: "en",
      loanType: "any",
      sections: [{ heading: "Value", body: "{{insurance.amount}}" }],
    }),
  );

  expect(error).toMatchObject({
    code: "UNKNOWN_PLACEHOLDER",
    placeholder: "insurance.amount",
  });
});

test("an administrator cannot edit another organization's template", async () => {
  const t = createConvexTest();
  const owner = await createLoanAdmin(t, "Owner Museum");
  const outsider = await createLoanAdmin(t, "Outsider Museum");
  const templateId = await createTemplate(owner, { name: "Owner terms" });

  const error = await templateErrorOf(
    outsider.authed.mutation(api.loanAgreementTemplates.update, {
      organizationId: outsider.organizationId,
      templateId,
      name: "Hijacked",
      language: "en",
      loanType: "any",
      sections: [conditionsSection],
    }),
  );

  expect(error?.code).toBe("TEMPLATE_NOT_FOUND");
  const template = await owner.authed.query(api.loanAgreementTemplates.get, {
    organizationId: owner.organizationId,
    templateId,
  });
  expect(template?.name).toBe("Owner terms");
});

test("an administrator cannot archive, restore or set as default another organization's template", async () => {
  const t = createConvexTest();
  const owner = await createLoanAdmin(t, "Owner Museum");
  const outsider = await createLoanAdmin(t, "Outsider Museum");
  const templateId = await createTemplate(owner);
  const target = { organizationId: outsider.organizationId, templateId };

  const codes = [
    (
      await templateErrorOf(
        outsider.authed.mutation(api.loanAgreementTemplates.archive, target),
      )
    )?.code,
    (
      await templateErrorOf(
        outsider.authed.mutation(api.loanAgreementTemplates.restore, target),
      )
    )?.code,
    (
      await templateErrorOf(
        outsider.authed.mutation(api.loanAgreementTemplates.setDefault, target),
      )
    )?.code,
  ];

  expect(codes).toEqual([
    "TEMPLATE_NOT_FOUND",
    "TEMPLATE_NOT_FOUND",
    "TEMPLATE_NOT_FOUND",
  ]);
});

test("staff cannot see the templates offered for another organization's loan", async () => {
  const t = createConvexTest();
  const owner = await createLoanAdmin(t, "Owner Museum");
  const outsider = await createLoanAdmin(t, "Outsider Museum");
  await createTemplate(owner);
  const loanId = await createLoan(owner, "outgoing");

  await expect(
    outsider.authed.query(api.loanAgreementTemplates.listForLoan, { loanId }),
  ).rejects.toThrow("Permission denied: loans.read");
});

test("listing shows only the organization's own templates, by name", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t, "Owner Museum");
  const other = await createLoanAdmin(t, "Other Museum");
  await createTemplate(admin, { name: "Outgoing terms" });
  await createTemplate(admin, { name: "Incoming terms" });
  await createTemplate(other, { name: "Someone else's terms" });

  const templates = await admin.authed.query(api.loanAgreementTemplates.list, {
    organizationId: admin.organizationId,
  });

  expect(templates.map((template) => template.name)).toEqual([
    "Incoming terms",
    "Outgoing terms",
  ]);
});

test("a loan is offered the templates for its direction with the direction default preselected", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  await createTemplate(admin, { name: "General", loanType: "any" });
  const outgoingId = await createTemplate(admin, {
    name: "Outgoing",
    loanType: "outgoing",
  });
  await createTemplate(admin, { name: "Incoming", loanType: "incoming" });
  await admin.authed.mutation(api.loanAgreementTemplates.setDefault, {
    organizationId: admin.organizationId,
    templateId: outgoingId,
  });
  const loanId = await createLoan(admin, "outgoing");

  const offer = await admin.authed.query(
    api.loanAgreementTemplates.listForLoan,
    { loanId },
  );

  expect(offer?.defaultTemplateId).toBe(outgoingId);
  expect(offer?.templates.map((template) => template.name)).toEqual([
    "General",
    "Outgoing",
  ]);
});

test("without a direction default the any-direction default is preselected", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const generalId = await createTemplate(admin, { loanType: "any" });
  const outgoingId = await createTemplate(admin, { loanType: "outgoing" });
  for (const templateId of [generalId, outgoingId]) {
    await admin.authed.mutation(api.loanAgreementTemplates.setDefault, {
      organizationId: admin.organizationId,
      templateId,
    });
  }
  const loanId = await createLoan(admin, "incoming");

  const offer = await admin.authed.query(
    api.loanAgreementTemplates.listForLoan,
    { loanId },
  );

  expect(offer?.defaultTemplateId).toBe(generalId);
});

test("without any default the built-in standard agreement is used", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  await createTemplate(admin);
  const loanId = await createLoan(admin, "outgoing");

  const offer = await admin.authed.query(
    api.loanAgreementTemplates.listForLoan,
    { loanId },
  );

  expect(offer?.defaultTemplateId).toBeNull();
});

test("a new default replaces the previous default for the same direction", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const firstId = await createTemplate(admin, {
    name: "First",
    loanType: "outgoing",
  });
  const secondId = await createTemplate(admin, {
    name: "Second",
    loanType: "outgoing",
  });
  for (const templateId of [firstId, secondId]) {
    await admin.authed.mutation(api.loanAgreementTemplates.setDefault, {
      organizationId: admin.organizationId,
      templateId,
    });
  }

  const templates = await admin.authed.query(api.loanAgreementTemplates.list, {
    organizationId: admin.organizationId,
  });

  expect(
    templates.map((template) => [template.name, template.isDefault]),
  ).toEqual([
    ["First", false],
    ["Second", true],
  ]);
});

test("moving a default template to another direction gives up its default", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const outgoingId = await createTemplate(admin, {
    name: "Outgoing",
    loanType: "outgoing",
  });
  const incomingId = await createTemplate(admin, {
    name: "Incoming",
    loanType: "incoming",
  });
  for (const templateId of [outgoingId, incomingId]) {
    await admin.authed.mutation(api.loanAgreementTemplates.setDefault, {
      organizationId: admin.organizationId,
      templateId,
    });
  }

  await admin.authed.mutation(api.loanAgreementTemplates.update, {
    organizationId: admin.organizationId,
    templateId: incomingId,
    name: "Incoming",
    language: "en",
    loanType: "outgoing",
    sections: [conditionsSection],
  });

  const templates = await admin.authed.query(api.loanAgreementTemplates.list, {
    organizationId: admin.organizationId,
  });
  expect(
    templates.map((template) => [template.name, template.isDefault]),
  ).toEqual([
    ["Incoming", false],
    ["Outgoing", true],
  ]);
});

test("organizations without the loans feature cannot manage templates", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    ADMIN_PERMISSIONS,
    { subscriptionTier: "free" },
  );

  await expect(
    authedForUser(t, userId).mutation(api.loanAgreementTemplates.create, {
      organizationId,
      name: "Free tier",
      language: "en",
      loanType: "any",
      sections: [conditionsSection],
    }),
  ).rejects.toThrow("Feature requires pro tier");
});

test("archiving retires a template from loans but keeps its record", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const templateId = await createTemplate(admin, { name: "Retired terms" });
  await admin.authed.mutation(api.loanAgreementTemplates.setDefault, {
    organizationId: admin.organizationId,
    templateId,
  });
  const loanId = await createLoan(admin, "outgoing");

  await admin.authed.mutation(api.loanAgreementTemplates.archive, {
    organizationId: admin.organizationId,
    templateId,
  });

  const offer = await admin.authed.query(
    api.loanAgreementTemplates.listForLoan,
    { loanId },
  );
  expect(offer).toEqual({ templates: [], defaultTemplateId: null });
  const archived = await admin.authed.query(api.loanAgreementTemplates.get, {
    organizationId: admin.organizationId,
    templateId,
  });
  expect(archived).toMatchObject({
    name: "Retired terms",
    status: "archived",
    isDefault: false,
    sections: [conditionsSection],
  });
});

test("an archived template cannot be edited or made the default", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const templateId = await createTemplate(admin);
  await admin.authed.mutation(api.loanAgreementTemplates.archive, {
    organizationId: admin.organizationId,
    templateId,
  });

  const editError = await templateErrorOf(
    admin.authed.mutation(api.loanAgreementTemplates.update, {
      organizationId: admin.organizationId,
      templateId,
      name: "Edited after archive",
      language: "en",
      loanType: "any",
      sections: [conditionsSection],
    }),
  );
  const defaultError = await templateErrorOf(
    admin.authed.mutation(api.loanAgreementTemplates.setDefault, {
      organizationId: admin.organizationId,
      templateId,
    }),
  );

  expect([editError?.code, defaultError?.code]).toEqual([
    "TEMPLATE_ARCHIVED",
    "TEMPLATE_ARCHIVED",
  ]);
});

test("every template change is recorded in the audit history", async () => {
  const t = createConvexTest();
  const { organizationId, userId } = await createOrgUserWithPermissions(
    t,
    [...ADMIN_PERMISSIONS, "collections.read"],
    { subscriptionTier: "pro" },
  );
  const authed = authedForUser(t, userId);
  const templateId = await authed.mutation(api.loanAgreementTemplates.create, {
    organizationId,
    name: "Audited",
    language: "en",
    loanType: "any",
    sections: [conditionsSection],
  });
  const target = { organizationId, templateId };
  await authed.mutation(api.loanAgreementTemplates.update, {
    ...target,
    name: "Audited (revised)",
    language: "en",
    loanType: "any",
    sections: [conditionsSection],
  });
  await authed.mutation(api.loanAgreementTemplates.setDefault, target);
  await authed.mutation(api.loanAgreementTemplates.archive, target);
  await authed.mutation(api.loanAgreementTemplates.restore, target);

  const history = await authed.query(api.auditLog.getByEntity, {
    organizationId,
    entityType: "loanAgreementTemplate",
    entityId: templateId,
  });

  expect(history.map((entry) => entry.action).sort()).toEqual([
    "archived_loan_agreement_template",
    "created_loan_agreement_template",
    "restored_loan_agreement_template",
    "set_default_loan_agreement_template",
    "updated_loan_agreement_template",
  ]);
});

test("purging an organization removes its loan agreement templates", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t, "Closing Library");
  // Inserted directly: audit history from the public mutations would mark the
  // organization as permanent evidence, which purges refuse by design.
  await t.run(async (ctx) => {
    await ctx.db.patch(admin.organizationId, { type: "library" });
    await ctx.db.insert("loanAgreementTemplates", {
      organizationId: admin.organizationId,
      name: "Standard",
      language: "en",
      loanType: "any",
      sections: [conditionsSection],
      isDefault: false,
      status: "active",
      createdBy: admin.userId,
      createdAt: Date.now(),
    });
  });
  const purge = (dryRun: boolean) =>
    t.mutation(internal.organizationCleanup.purgeOrganizationsInternal, {
      organizationIds: [admin.organizationId],
      dryRun,
    });

  const [dryRun] = await purge(true);
  expect(dryRun?.tableCounts).toContainEqual({
    table: "loanAgreementTemplates",
    count: 1,
  });
  await purge(false);

  const remaining = await t.run(async (ctx) =>
    ctx.db.query("loanAgreementTemplates").take(1),
  );
  expect(remaining).toEqual([]);
});

test("archived templates are listed on request and can be restored", async () => {
  const t = createConvexTest();
  const admin = await createLoanAdmin(t);
  const templateId = await createTemplate(admin, { name: "Seasonal terms" });
  await admin.authed.mutation(api.loanAgreementTemplates.archive, {
    organizationId: admin.organizationId,
    templateId,
  });

  const archivedList = await admin.authed.query(
    api.loanAgreementTemplates.list,
    { organizationId: admin.organizationId, includeArchived: true },
  );
  expect(archivedList.map((template) => template.status)).toEqual(["archived"]);

  await admin.authed.mutation(api.loanAgreementTemplates.restore, {
    organizationId: admin.organizationId,
    templateId,
  });
  const activeList = await admin.authed.query(api.loanAgreementTemplates.list, {
    organizationId: admin.organizationId,
  });
  expect(activeList.map((template) => template.name)).toEqual([
    "Seasonal terms",
  ]);
});
