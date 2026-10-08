import { getAuthUserId } from "@convex-dev/auth/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { requireLoansAccess } from "./utils/loanAccess";
import { loanAgreementTemplateError } from "./utils/loanAgreementErrors";
import { parseLoanAgreementTemplateText } from "./utils/loanAgreementPlaceholders";
import {
  LOAN_AGREEMENT_TEMPLATE_LIMITS,
  loanAgreementLanguageValidator,
  loanAgreementLoanTypeValidator,
  loanAgreementSectionValidator,
  loanAgreementTemplateFields,
} from "./utils/loanAgreementValidators";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

const templateValidator = v.object({
  _id: v.id("loanAgreementTemplates"),
  _creationTime: v.number(),
  ...loanAgreementTemplateFields,
});

const templateContentArgs = {
  name: v.string(),
  language: loanAgreementLanguageValidator,
  loanType: loanAgreementLoanTypeValidator,
  sections: v.array(loanAgreementSectionValidator),
};

type TemplateSection = Infer<typeof loanAgreementSectionValidator>;

/** Trims and validates editable template content before it is stored. */
function validatedContent(args: { name: string; sections: TemplateSection[] }) {
  const name = args.name.trim();
  if (!name) {
    throw loanAgreementTemplateError("NAME_REQUIRED", "Name is required");
  }
  if (
    args.sections.length === 0 ||
    args.sections.some((section) => !section.body.trim())
  ) {
    throw loanAgreementTemplateError(
      "SECTIONS_REQUIRED",
      "Every section needs text",
    );
  }
  const limits = LOAN_AGREEMENT_TEMPLATE_LIMITS;
  const sections = args.sections.map((section) => ({
    heading: section.heading.trim(),
    body: section.body,
  }));
  if (
    name.length > limits.nameLength ||
    sections.length > limits.sections ||
    sections.some(
      (section) =>
        section.heading.length > limits.headingLength ||
        section.body.length > limits.bodyLength,
    )
  ) {
    throw loanAgreementTemplateError(
      "TEMPLATE_TOO_LARGE",
      "Template exceeds the size limits",
    );
  }
  assertKnownPlaceholders(sections);
  return { name, sections };
}

function assertKnownPlaceholders(sections: TemplateSection[]) {
  for (const section of sections) {
    for (const text of [section.heading, section.body]) {
      const parsed = parseLoanAgreementTemplateText(text);
      if (parsed.ok) continue;
      if (parsed.problem === "UNKNOWN_PLACEHOLDER") {
        throw loanAgreementTemplateError(
          "UNKNOWN_PLACEHOLDER",
          `Unknown placeholder: ${parsed.placeholder}`,
          { placeholder: parsed.placeholder },
        );
      }
      throw loanAgreementTemplateError(
        "MALFORMED_PLACEHOLDER",
        "Placeholders must be written as {{name}}",
      );
    }
  }
}

async function requireTemplateAdministrator(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const [userId] = await Promise.all([
    getAuthUserId(ctx),
    requireLoansAccess(ctx, organizationId),
    requirePermission(ctx, organizationId, "organization.manage_settings"),
  ] as const);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** Loads a template for a write, treating another tenant's ID as missing. */
async function requireOrganizationTemplate(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  templateId: Id<"loanAgreementTemplates">,
) {
  const template = await ctx.db.get(templateId);
  if (!template || template.organizationId !== organizationId) {
    throw loanAgreementTemplateError(
      "TEMPLATE_NOT_FOUND",
      "Loan agreement template not found",
    );
  }
  return template;
}

async function recordTemplateChange(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    templateId: Id<"loanAgreementTemplates">;
    action: "created" | "updated" | "archived" | "restored" | "set_default";
    changes: Record<string, string | number | boolean>;
  },
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: args.organizationId,
    userId: args.userId,
    action: `${args.action}_loan_agreement_template`,
    entityType: "loanAgreementTemplate",
    entityId: args.templateId,
    changes: args.changes,
  });
}

function contentSummary(content: {
  name: string;
  language: string;
  loanType: string;
  sections: TemplateSection[];
}) {
  return {
    name: content.name,
    language: content.language,
    loanType: content.loanType,
    sectionCount: content.sections.length,
  };
}

async function requireActiveTemplate(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  templateId: Id<"loanAgreementTemplates">,
) {
  const template = await requireOrganizationTemplate(
    ctx,
    organizationId,
    templateId,
  );
  if (template.status === "archived") {
    throw loanAgreementTemplateError(
      "TEMPLATE_ARCHIVED",
      "Restore the template before changing it",
    );
  }
  return template;
}

/** Upper bound on templates returned per organization and status. */
const LIST_LIMIT = 200;

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}

async function templatesWithStatus(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  status: "active" | "archived",
) {
  const templates = await ctx.db
    .query("loanAgreementTemplates")
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", status),
    )
    .take(LIST_LIMIT);
  return templates.sort(byName);
}

/** Active templates by name, followed by archived ones when requested. */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(templateValidator),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "loans.read");
    const active = await templatesWithStatus(
      ctx,
      args.organizationId,
      "active",
    );
    if (!args.includeArchived) return active;
    const archived = await templatesWithStatus(
      ctx,
      args.organizationId,
      "archived",
    );
    return [...active, ...archived];
  },
});

/**
 * Templates a loan's agreement can be generated from: active templates for the
 * loan's direction or for any direction. The preselected template is the
 * direction default, then the any-direction default; null means the built-in
 * standard agreement.
 */
export const listForLoan = query({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.union(
    v.object({
      templates: v.array(templateValidator),
      defaultTemplateId: v.union(v.id("loanAgreementTemplates"), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) return null;
    await requirePermission(ctx, loan.organizationId, "loans.read");

    const active = await templatesWithStatus(
      ctx,
      loan.organizationId,
      "active",
    );
    const templates = active.filter(
      (template) =>
        template.loanType === "any" || template.loanType === loan.type,
    );
    const defaultFor = (loanType: "any" | "incoming" | "outgoing") =>
      templates.find(
        (template) => template.isDefault && template.loanType === loanType,
      );
    const preselected = defaultFor(loan.type) ?? defaultFor("any");
    return { templates, defaultTemplateId: preselected?._id ?? null };
  },
});

export const get = query({
  args: {
    organizationId: v.id("organizations"),
    templateId: v.id("loanAgreementTemplates"),
  },
  returns: v.union(templateValidator, v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "loans.read");
    const template = await ctx.db.get(args.templateId);
    return template?.organizationId === args.organizationId ? template : null;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    ...templateContentArgs,
  },
  returns: v.id("loanAgreementTemplates"),
  handler: async (ctx, args) => {
    const userId = await requireTemplateAdministrator(ctx, args.organizationId);
    const { name, sections } = validatedContent(args);
    const content = {
      name,
      language: args.language,
      loanType: args.loanType,
      sections,
    };

    const templateId = await ctx.db.insert("loanAgreementTemplates", {
      organizationId: args.organizationId,
      ...content,
      isDefault: false,
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });
    await recordTemplateChange(ctx, {
      organizationId: args.organizationId,
      userId,
      templateId,
      action: "created",
      changes: contentSummary(content),
    });
    return templateId;
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    templateId: v.id("loanAgreementTemplates"),
    ...templateContentArgs,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireTemplateAdministrator(ctx, args.organizationId);
    const template = await requireActiveTemplate(
      ctx,
      args.organizationId,
      args.templateId,
    );
    const { name, sections } = validatedContent(args);
    const content = {
      name,
      language: args.language,
      loanType: args.loanType,
      sections,
    };

    await ctx.db.patch(args.templateId, {
      ...content,
      // A default belongs to one direction; moving the template gives it up so
      // the new direction keeps a single default.
      isDefault: template.isDefault && template.loanType === args.loanType,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await recordTemplateChange(ctx, {
      organizationId: args.organizationId,
      userId,
      templateId: args.templateId,
      action: "updated",
      changes: contentSummary(content),
    });
    return null;
  },
});

/**
 * Retires a template: it is no longer offered for loans and stops being a
 * default, but the record stays (institutional records are permanent).
 */
export const archive = mutation({
  args: {
    organizationId: v.id("organizations"),
    templateId: v.id("loanAgreementTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireTemplateAdministrator(ctx, args.organizationId);
    const template = await requireOrganizationTemplate(
      ctx,
      args.organizationId,
      args.templateId,
    );
    await ctx.db.patch(args.templateId, {
      status: "archived",
      isDefault: false,
      archivedBy: userId,
      archivedAt: Date.now(),
    });
    await recordTemplateChange(ctx, {
      organizationId: args.organizationId,
      userId,
      templateId: args.templateId,
      action: "archived",
      changes: { name: template.name, wasDefault: template.isDefault },
    });
    return null;
  },
});

/** Returns an archived template to use; it does not become a default again. */
export const restore = mutation({
  args: {
    organizationId: v.id("organizations"),
    templateId: v.id("loanAgreementTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireTemplateAdministrator(ctx, args.organizationId);
    const template = await requireOrganizationTemplate(
      ctx,
      args.organizationId,
      args.templateId,
    );
    await ctx.db.patch(args.templateId, {
      status: "active",
      archivedBy: undefined,
      archivedAt: undefined,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await recordTemplateChange(ctx, {
      organizationId: args.organizationId,
      userId,
      templateId: args.templateId,
      action: "restored",
      changes: { name: template.name },
    });
    return null;
  },
});

/** Makes a template the default for its loan direction, replacing any other. */
export const setDefault = mutation({
  args: {
    organizationId: v.id("organizations"),
    templateId: v.id("loanAgreementTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireTemplateAdministrator(ctx, args.organizationId);
    const template = await requireActiveTemplate(
      ctx,
      args.organizationId,
      args.templateId,
    );

    const currentDefaults = await ctx.db
      .query("loanAgreementTemplates")
      .withIndex("by_organization_and_loanType_and_isDefault", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("loanType", template.loanType)
          .eq("isDefault", true),
      )
      .take(LIST_LIMIT);
    for (const current of currentDefaults) {
      if (current._id !== template._id) {
        await ctx.db.patch(current._id, { isDefault: false });
      }
    }
    await ctx.db.patch(template._id, {
      isDefault: true,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    await recordTemplateChange(ctx, {
      organizationId: args.organizationId,
      userId,
      templateId: template._id,
      action: "set_default",
      changes: { name: template.name, loanType: template.loanType },
    });
    return null;
  },
});
