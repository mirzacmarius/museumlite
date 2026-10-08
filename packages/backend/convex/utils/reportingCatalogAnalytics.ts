import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type CatalogAnalyticsCtx = Pick<QueryCtx, "db">;

export type CatalogGrowthSnapshot = {
  accessions: Array<{
    approvedAt?: number;
  }>;
  deaccessions: Array<{
    approvedAt?: number;
  }>;
  historicalTotalsAvailable: false;
};

/**
 * Load catalog growth inputs using status indexes instead of org-wide table scans.
 */
export async function loadCatalogGrowthSnapshot(
  ctx: CatalogAnalyticsCtx,
  organizationId: Id<"organizations">,
): Promise<CatalogGrowthSnapshot> {
  const [accessions, deaccessions] = await Promise.all([
    (async () => {
      const rows: CatalogGrowthSnapshot["accessions"] = [];
      const approved = ctx.db
        .query("accessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "approved"),
        );
      for await (const accession of approved) {
        rows.push({ approvedAt: accession.approvedAt });
      }
      return rows;
    })(),
    (async () => {
      const rows: CatalogGrowthSnapshot["deaccessions"] = [];
      const approved = ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "approved"),
        );
      for await (const deaccession of approved) {
        rows.push({ approvedAt: deaccession.approvedAt });
      }
      return rows;
    })(),
  ] as const);

  return { accessions, deaccessions, historicalTotalsAvailable: false };
}
