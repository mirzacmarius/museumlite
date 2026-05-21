import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { NOTIFICATION_TYPES } from "./notifications";
import { requirePermission } from "./utils/permissions";

const mentionPattern = /@([a-zA-Z0-9._-]+)/g;

function normalizeHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function getUserHandle(user: {
  username?: string | null;
  email?: string | null;
  name?: string | null;
}) {
  const base = user.username ?? user.email?.split("@")[0] ?? user.name ?? "";
  const handle = normalizeHandle(base);
  return handle.length > 0 ? handle : null;
}

export const list = query({
  args: {
    objectId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("objectComments"),
      userId: v.id("users"),
      userName: v.optional(v.string()),
      userImage: v.optional(v.string()),
      content: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const object = await ctx.db.get(args.objectId);
    if (!object) return [];

    const [, comments] = await Promise.all([
      requirePermission(ctx, object.organizationId, "collections.read"),
      ctx.db
        .query("objectComments")
        .withIndex("by_object", (q) => q.eq("objectId", args.objectId))
        .collect(),
    ] as const);

    const commentsWithUsers = await Promise.all(
      comments.map(async (c) => {
        const user = await ctx.db.get(c.userId);
        return {
          _id: c._id,
          userId: c.userId,
          userName: user?.name ?? user?.username,
          userImage: user?.image,
          content: c.content,
          createdAt: c.createdAt,
        };
      }),
    );

    return commentsWithUsers.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const create = mutation({
  args: {
    objectId: v.id("collections"),
    content: v.string(),
  },
  returns: v.id("objectComments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const object = await ctx.db.get(args.objectId);
    if (!object) throw new Error("Object not found");

    await requirePermission(ctx, object.organizationId, "collections.update");

    const mentionHandles = new Set<string>();
    mentionPattern.lastIndex = 0;
    let mentionMatch = mentionPattern.exec(args.content);
    while (mentionMatch) {
      if (mentionMatch[1]) {
        mentionHandles.add(mentionMatch[1].toLowerCase());
      }
      mentionMatch = mentionPattern.exec(args.content);
    }

    let mentionedUserIds: Id<"users">[] = [];

    if (mentionHandles.size > 0) {
      const members = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", object.organizationId),
        )
        .collect();

      const users = await Promise.all(
        members.map(async (member) => ctx.db.get(member.userId)),
      );

      for (const user of users) {
        if (!user) continue;
        const handle = getUserHandle(user);
        if (handle && mentionHandles.has(handle)) {
          mentionedUserIds.push(user._id);
        }
      }
    }

    mentionedUserIds = Array.from(new Set(mentionedUserIds)).filter(
      (mentionedUserId) => mentionedUserId !== userId,
    );

    const commentId = await ctx.db.insert("objectComments", {
      organizationId: object.organizationId,
      objectId: args.objectId,
      userId,
      content: args.content,
      mentionedUserIds:
        mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
      createdAt: Date.now(),
    });

    if (mentionedUserIds.length > 0) {
      const author = await ctx.db.get(userId);
      const authorName = author?.name ?? author?.username ?? "Someone";

      await Promise.all(
        mentionedUserIds.map(async (mentionedUserId) => {
          const shouldNotify = await ctx.runMutation(
            internal.notifications.shouldSendNotification,
            {
              organizationId: object.organizationId,
              userId: mentionedUserId,
              notificationType: NOTIFICATION_TYPES.COMMENT_MENTION,
            },
          );

          if (!shouldNotify) {
            return;
          }

          await ctx.runMutation(internal.notifications.sendNotification, {
            organizationId: object.organizationId,
            userId: mentionedUserId,
            type: NOTIFICATION_TYPES.COMMENT_MENTION,
            title: "You were mentioned",
            message: `${authorName} mentioned you on ${object.title}`,
            relatedEntityType: "object",
            relatedEntityId: args.objectId,
          });
        }),
      );
    }

    return commentId;
  },
});

export const remove = mutation({
  args: {
    commentId: v.id("objectComments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    if (comment.userId !== userId) {
      throw new Error("Can only delete your own comments");
    }

    await ctx.db.delete(args.commentId);
    return null;
  },
});
