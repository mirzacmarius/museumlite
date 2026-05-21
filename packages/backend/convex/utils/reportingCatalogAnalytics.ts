import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type CatalogAnalyticsCtx = Pick<QueryCtx, "db">;

export type CatalogGrowthSnapshot = {
  accessions: Array<{
    approvedAt?: number;
  }>;
  deaccessions: Array<{
    approvedAt?: number;
  }>;
  collections: Array<{
    _creationTime: number;
    status: Doc<"collections">["status"];
  }>;
};

/**
 * Load catalog growth inputs using status indexes instead of org-wide table scans.
 */
export async function loadCatalogGrowthSnapshot(
  ctx: CatalogAnalyticsCtx,
  organizationId: Id<"organizations">,
): Promise<CatalogGrowthSnapshot> {
  const [accessions, deaccessions, collections] = await Promise.all([
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
    (async () => {
      const rows: CatalogGrowthSnapshot["collections"] = [];
      for (const status of [
        "active",
        "loaned",
        "archived",
        "deaccessioned",
      ] as const) {
        const catalogRows = ctx.db
          .query("collections")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", organizationId).eq("status", status),
          );
        for await (const collection of catalogRows) {
          rows.push({
            _creationTime: collection._creationTime,
            status: collection.status,
          });
        }
      }
      return rows;
    })(),
  ] as const);

  return { accessions, deaccessions, collections };
}
