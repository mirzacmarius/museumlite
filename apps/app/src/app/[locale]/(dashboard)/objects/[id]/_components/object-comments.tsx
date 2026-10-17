"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import { Skeleton } from "@v1/ui/skeleton";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { AtSign, Loader2, MessageSquare, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClientRelativeTime } from "@/components/client-date";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useCurrentLocale, useI18n } from "@/locales/client";

type CommentItem = {
  _id: Id<"objectComments">;
  userId: Id<"users">;
  userName?: string;
  userImage?: string;
  content: string;
  createdAt: number;
};

type MentionState = {
  query: string;
  start: number;
  end: number;
};

type MentionUser = {
  _id: Id<"users">;
  name: string | undefined;
  email: string | undefined;
  image: string | undefined;
  handle: string;
};

interface ObjectCommentsProps {
  objectId: Id<"collections">;
  organizationId: Id<"organizations">;
}

const _mentionPattern = /@([a-zA-Z0-9._-]*)$/;

function normalizeHandle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

function getUserHandle(user: {
  name?: string | null;
  email?: string | null;
  username?: string | null;
}) {
  const base = user.username ?? user.email?.split("@")[0] ?? user.name ?? "";
  return normalizeHandle(base);
}

function getMentionState(value: string, cursor: number): MentionState | null {
  if (cursor < 0) return null;
  const text = value.slice(0, cursor);
  const lastAt = text.lastIndexOf("@");
  if (lastAt === -1) return null;
  const prevChar = text[lastAt - 1];
  if (prevChar && /\S/.test(prevChar)) return null;
  const query = text.slice(lastAt + 1);
  if (/\s/.test(query)) return null;
  return { query, start: lastAt, end: cursor };
}

export function ObjectComments({
  objectId,
  organizationId,
}: ObjectCommentsProps) {
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const actionErrorMessage = useActionErrorMessage();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [content, setContent] = useState("");
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comments = useQuery(api.objectComments.list, {
    objectId,
  }) as CommentItem[] | undefined;

  const organizationUsers = useQuery(api.organizations.listOrganizationUsers, {
    organizationId,
  });

  const createComment = useMutation(api.objectComments.create);

  const mentionUsers = useMemo(() => {
    if (!organizationUsers) return [];
    return organizationUsers.flatMap((user) => {
      const handle = getUserHandle(user);
      if (!handle) return [];
      return [
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
          handle,
        },
      ];
    });
  }, [organizationUsers]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionState) return [];
    const query = mentionState.query.toLowerCase();
    return mentionUsers
      .filter((user) => user.handle.includes(query))
      .slice(0, 6);
  }, [mentionState, mentionUsers]);

  const handleContentChange = (value: string) => {
    setContent(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    setMentionState(getMentionState(value, cursor));
  };

  const handleSelectMention = (user: MentionUser) => {
    if (!mentionState) return;
    const before = content.slice(0, mentionState.start);
    const after = content.slice(mentionState.end);
    const nextValue = `${before}@${user.handle} ${after}`;
    setContent(nextValue);
    setMentionState(null);

    requestAnimationFrame(() => {
      const cursorPosition = before.length + user.handle.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await createComment({
        objectId,
        content: content.trim(),
      });
      setContent("");
      setMentionState(null);
    } catch (error) {
      console.error(error);
      toast.error(
        actionErrorMessage(
          error,
          tRoot("untranslatedRecords.objects.comments.failedAdd"),
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = comments === undefined;

  return (
    <div className="space-y-6 rounded-xl border border-border/60 bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {tRoot("untranslatedRecords.objects.comments.title")}
        </h3>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : comments.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={tRoot("untranslatedRecords.objects.comments.emptyTitle")}
            description={tRoot(
              "untranslatedRecords.objects.comments.emptyDescription",
            )}
            size="sm"
          />
        ) : (
          comments.map((comment) => {
            const initials = comment.userName
              ? comment.userName
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
              : "?";
            return (
              <div
                key={comment._id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-4"
              >
                <Avatar className="size-9">
                  <AvatarImage src={comment.userImage ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {comment.userName ??
                          tRoot("untranslatedRecords.objects.comments.unknown")}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        <ClientRelativeTime
                          timestamp={comment.createdAt}
                          locale={locale}
                          options={{ addSuffix: true }}
                        />
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="relative space-y-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => handleContentChange(event.target.value)}
            placeholder={tRoot(
              "untranslatedRecords.objects.comments.placeholder",
            )}
            rows={3}
            className="pr-12"
            onKeyDown={(event) => {
              if (event.key === "Escape") setMentionState(null);
            }}
          />
          <Button
            size="icon"
            className="absolute right-2 top-2 size-8"
            onClick={handleSubmit}
            disabled={isSubmitting || content.trim().length === 0}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AtSign className="size-3" />
          {tRoot("untranslatedRecords.objects.comments.mentionHint")}
        </div>

        {mentionState && mentionSuggestions.length > 0 && (
          <div className="absolute z-20 mt-2 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg">
            <div className="space-y-1">
              {mentionSuggestions.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => handleSelectMention(user)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  )}
                >
                  <Avatar className="size-6">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(user.name || user.email || "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {user.name ??
                        user.email ??
                        tRoot("untranslatedRecords.objects.comments.user")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{user.handle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
