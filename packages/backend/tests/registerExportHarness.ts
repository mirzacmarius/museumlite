import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { expect, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "./testSetup";

/** Shared fixtures and decoders for register export tests. */

export type Source = FunctionArgs<typeof api.exports.create>["source"];
export type Cell = string | number | boolean | null;
export interface Column {
  name: string;
  type: string;
}

export const T0 = Date.UTC(2026, 0, 1);

export async function fixture(
  tier: "free" | "pro" | "enterprise" = "pro",
  permissions = ["collections.read", "locations.read", "loans.read"],
) {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Museum",
      slug: "registers",
      type: "museum",
      subscriptionTier: tier,
    });
    const otherOrganizationId = await ctx.db.insert("organizations", {
      name: "Other Museum",
      slug: "other-registers",
      type: "museum",
      subscriptionTier: "pro",
    });
    const userId = await ctx.db.insert("users", {
      email: "registrar@example.test",
    });
    const roleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Registrar",
      isSystemRole: false,
    });
    for (const name of permissions) {
      const permissionId = await ctx.db.insert("permissions", {
        name,
        category: "collections",
      });
      await ctx.db.insert("rolePermissions", { roleId, permissionId });
    }
    const membershipId = await ctx.db.insert("userOrganizations", {
      userId,
      organizationId,
      roleId,
      joinedAt: T0,
    });
    return { organizationId, otherOrganizationId, userId, membershipId };
  });
  return {
    t,
    ...ids,
    user: t.withIdentity({ subject: `${ids.userId}|test` }),
  };
}
export type Fixture = Awaited<ReturnType<typeof fixture>>;

export async function insertObject(
  f: Fixture,
  fields: {
    accessionNumber: string;
    title: string;
    organizationId?: Id<"organizations">;
    status?: "active" | "loaned" | "deaccessioned" | "archived" | "deleted";
    condition?: string;
    conditionHistory?: Array<{
      condition: string;
      changedAt: number;
      changedBy: Id<"users">;
      note?: string;
    }>;
    accessionNumberHistory?: Array<{
      number: string;
      validFrom: number;
      validTo?: number;
    }>;
    provenance?: string;
    ownershipHistory?: Array<{
      owner: string;
      startYear?: string;
      endYear?: string;
      description?: string;
      verified?: boolean;
      verificationSource?: string;
    }>;
  },
) {
  return await f.t.run((ctx) =>
    ctx.db.insert("collections", {
      organizationId: f.organizationId,
      status: "active",
      catalogedBy: f.userId,
      catalogedAt: T0,
      ...fields,
    }),
  );
}

export async function runExport(
  f: Fixture,
  source: Source,
  format: "csv" | "jsonl",
  requestKey: string,
) {
  const jobId = await f.user.mutation(api.exports.create, {
    organizationId: f.organizationId,
    requestKey,
    format,
    source,
  });
  await f.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
  const job = await f.user.query(api.exports.status, { jobId });
  return { jobId, job };
}

export async function downloadText(f: Fixture, jobId: Id<"exportJobs">) {
  const response = await f.user.fetch(`/exports/download?jobId=${jobId}`);
  expect(response.status).toBe(200);
  return await response.text();
}

export async function downloadManifest(f: Fixture, jobId: Id<"exportJobs">) {
  const response = await f.user.fetch(`/exports/manifest?jobId=${jobId}`);
  expect(response.status).toBe(200);
  return (await response.json()) as {
    columns: Column[];
    generator: Record<string, unknown>;
    criteria: Record<string, unknown>;
    effectiveAsOf: number;
    organizationId: string;
    requestedBy: string;
    compatibility: string;
    consistency: string;
    totals?: {
      groupBy: string[];
      amountColumn: string;
      currencyColumn: string;
      definition: string;
      entries: Array<Record<string, Cell>>;
    };
  };
}

/** RFC 4180 reader that keeps whether each field was quoted. */
export function readCsv(text: string) {
  const records: Array<Array<{ raw: string; quoted: boolean }>> = [];
  let record: Array<{ raw: string; quoted: boolean }> = [];
  let raw = "";
  let quoted = false;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        raw += '"';
        i++;
      } else if (char === '"') inQuotes = false;
      else raw += char;
    } else if (char === '"') {
      inQuotes = true;
      quoted = true;
    } else if (char === ",") {
      record.push({ raw, quoted });
      raw = "";
      quoted = false;
    } else if (char === "\r" && text[i + 1] === "\n") {
      record.push({ raw, quoted });
      records.push(record);
      record = [];
      raw = "";
      quoted = false;
      i++;
    } else raw += char;
  }
  return records;
}

/** Decodes a register CSV using the manifest column schema. */
export function decodeRegisterCsv(text: string, columns: Column[]) {
  const [header, ...records] = readCsv(text);
  expect(header?.map((cell) => cell.raw)).toEqual(columns.map((c) => c.name));
  return records.map((record) => {
    const row: Record<string, Cell> = {};
    columns.forEach((column, index) => {
      const cell = record[index];
      if (!cell) throw new Error("Missing CSV cell");
      if (!cell.quoted && cell.raw === "") row[column.name] = null;
      else if (column.type === "text" || column.type === "id")
        row[column.name] = cell.raw.startsWith("'")
          ? cell.raw.slice(1)
          : cell.raw;
      else if (column.type === "boolean")
        row[column.name] = cell.raw === "true";
      else row[column.name] = Number(cell.raw);
    });
    return row;
  });
}

export function decodeJsonl(text: string) {
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, Cell>);
}

export async function errorCodeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    const data: unknown =
      typeof error.data === "string" ? JSON.parse(error.data) : error.data;
    return typeof data === "object" && data !== null && "code" in data
      ? data.code
      : undefined;
  }
  throw new Error("Expected the request to be refused");
}

export function withoutCapture(rows: Array<Record<string, Cell>>) {
  return rows.map(({ capturedAt: _capturedAt, ...rest }) => rest);
}
