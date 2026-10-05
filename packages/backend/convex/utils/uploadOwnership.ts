import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { env } from "../env";

export const MAX_OWNED_UPLOAD_BYTES = 20 * 1024 * 1024;

export function validateOwnedUploadSize(fileSize: number) {
  if (
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > MAX_OWNED_UPLOAD_BYTES
  )
    throw new Error("File must be between 1 byte and 20 MB");
}

const UPLOAD_INTENT_LIFETIME_MS = 10 * 60 * 1000;

export async function createAuthorizedUploadUrl(
  ctx: MutationCtx,
  uploadedBy: Id<"users">,
  organizationId?: Id<"organizations">,
): Promise<string> {
  if (!env.CONVEX_SITE_URL) throw new Error("Upload service URL unavailable");
  const token = crypto.randomUUID();
  const createdAt = Date.now();
  await ctx.db.insert("uploadIntents", {
    token,
    uploadedBy,
    organizationId,
    createdAt,
    expiresAt: createdAt + UPLOAD_INTENT_LIFETIME_MS,
  });
  const url = new URL("/upload-owned-file", env.CONVEX_SITE_URL);
  url.searchParams.set("intent", token);
  return url.toString();
}

export async function claimStorageOwnership(
  ctx: MutationCtx,
  args: {
    storageId: Id<"_storage">;
    organizationId?: Id<"organizations">;
    uploadedBy: Id<"users">;
    ownerType: string;
    ownerId: string;
  },
): Promise<void> {
  const upload = await ctx.db
    .query("storageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
    .unique();
  if (!upload || !(await ctx.db.system.get("_storage", args.storageId))) {
    throw new Error(
      "File was not uploaded through an authorized upload session",
    );
  }
  if (upload.organizationId !== args.organizationId)
    throw new Error("File belongs to a different organization");
  if (upload.ownerType || upload.ownerId) {
    if (upload.ownerType === args.ownerType && upload.ownerId === args.ownerId)
      return;
    throw new Error("File is already attached to another record");
  }
  if (upload.uploadedBy !== args.uploadedBy)
    throw new Error("File belongs to a different uploader");
  await ctx.db.patch(upload._id, {
    organizationId: args.organizationId,
    ownerType: args.ownerType,
    ownerId: args.ownerId,
  });
}

export async function transferStorageOwnership(
  ctx: MutationCtx,
  args: {
    storageId: Id<"_storage">;
    organizationId: Id<"organizations">;
    fromOwnerType: string;
    fromOwnerId: string;
    ownerType: string;
    ownerId: string;
  },
) {
  const upload = await ctx.db
    .query("storageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
    .unique();
  if (
    !upload ||
    upload.organizationId !== args.organizationId ||
    upload.ownerType !== args.fromOwnerType ||
    upload.ownerId !== args.fromOwnerId ||
    !(await ctx.db.system.get("_storage", args.storageId))
  )
    throw new Error("File ownership requires review before publication");
  await ctx.db.patch(upload._id, {
    ownerType: args.ownerType,
    ownerId: args.ownerId,
  });
}
