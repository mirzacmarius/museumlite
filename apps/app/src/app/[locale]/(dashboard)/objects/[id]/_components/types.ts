import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";

export type CollectionData = NonNullable<
  FunctionReturnType<typeof api.collections.getObjectDetail>
>["collection"];

export type ObjectDetailData = NonNullable<
  FunctionReturnType<typeof api.collections.getObjectDetail>
>;

export interface HeroImageData {
  url: string;
  thumbnailUrl?: string | null;
}

export interface LocationPathItem {
  _id: Id<"locations">;
  name: string;
  locationCode: string;
}

export interface LoanForCollection {
  _id: Id<"loans">;
  loanNumber: string;
  type: "incoming" | "outgoing";
  status: string;
  lenderBorrowerName: string;
  startDate: number;
  endDate?: number;
}
