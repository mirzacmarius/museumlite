"use client";

import { GitBranch, User } from "lucide-react";

interface ActivityItemProps {
  action: string;
  entityType: string;
  entityId: string;
  userName?: string;
  userImage?: string;
  timestamp: number;
  changes?: any;
}

function getActionIcon(entityType: string) {
  switch (entityType) {
    case "organization":
      return <GitBranch className="h-4 w-4 text-white/60" />;
    default:
      return <User className="h-4 w-4 text-white/60" />;
  }
}

function formatActionDescription(
  action: string,
  entityType: string,
  entityId: string,
  changes?: any,
): React.ReactNode {
  const parts: React.ReactNode[] = ["You "];

  // Format action verb
  const actionVerb = action.toLowerCase();
  parts.push(actionVerb);

  // Add entity type
  parts.push(" ");
  parts.push(<strong key="entity-type">{entityType}</strong>);

  // Add entity identifier if available
  if (changes?.name || changes?.title || changes?.accessionNumber) {
    parts.push(" ");
    const identifier =
      changes.name || changes.title || changes.accessionNumber;
    parts.push(<strong key="identifier">{identifier}</strong>);
  } else {
    parts.push(" ");
    parts.push(<strong key="entity-id">{entityId.slice(-8)}</strong>);
  }

  return <>{parts}</>;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y`;
  if (months > 0) return `${months}mo`;
  if (weeks > 0) return `${weeks}w`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "now";
}

export function ActivityItem({
  action,
  entityType,
  entityId,
  userName,
  userImage,
  timestamp,
  changes,
}: ActivityItemProps) {
  const relativeTime = formatRelativeTime(timestamp);

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex-shrink-0">{getActionIcon(entityType)}</div>
      <div className="flex flex-1 items-start justify-between gap-4">
        <div className="flex-1 text-sm text-white">
          {formatActionDescription(action, entityType, entityId, changes)}
        </div>
        <div className="text-sm text-white/60">{relativeTime}</div>
      </div>
    </div>
  );
}

