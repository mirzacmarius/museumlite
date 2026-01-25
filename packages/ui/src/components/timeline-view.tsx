"use client";

import * as React from "react";

import { cn } from "@v1/ui/utils";

export interface TimelineEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate?: Date;
  status: "past" | "current" | "upcoming";
  color?: "emerald" | "blue" | "amber" | "indigo";
}

export interface TimelineViewProps {
  events: TimelineEvent[];
  startDate: Date;
  endDate: Date;
  onEventClick?: (event: TimelineEvent) => void;
  className?: string;
}

export function TimelineView({
  events,
  startDate,
  endDate,
  onEventClick,
  className,
}: TimelineViewProps) {
  const calculatePosition = (date: Date) => {
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = date.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  };

  const now = new Date();
  const currentPosition = calculatePosition(now);
  const showCurrentIndicator = now >= startDate && now <= endDate;

  const getEventColor = (event: TimelineEvent) => {
    if (event.color) {
      switch (event.color) {
        case "emerald":
          return "bg-emerald-500 text-white border-emerald-600";
        case "blue":
          return "bg-blue-500 text-white border-blue-600";
        case "amber":
          return "bg-amber-500 text-white border-amber-600";
        case "indigo":
          return "bg-indigo-500 text-white border-indigo-600";
      }
    }

    switch (event.status) {
      case "past":
        return "bg-muted text-muted-foreground border-border";
      case "current":
        return "bg-emerald-500 text-white border-emerald-600";
      case "upcoming":
        return "bg-blue-500 text-white border-blue-600";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className={cn("relative py-8", className)}>
      {/* Timeline base line */}
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />

      {/* Current date indicator */}
      {showCurrentIndicator && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
          style={{ left: `${currentPosition}%` }}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-medium text-primary whitespace-nowrap">
            Today
          </div>
        </div>
      )}

      {/* Events */}
      {events.map((event) => {
        const position = calculatePosition(event.startDate);
        const isInteractive = onEventClick !== undefined;

        return (
          <div
            key={event.id}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${position}%` }}
          >
            <div
              onClick={() => onEventClick?.(event)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all duration-200",
                getEventColor(event),
                isInteractive &&
                  "cursor-pointer hover:scale-105 hover:shadow-lg",
              )}
              title={`${event.title} - ${event.startDate.toLocaleDateString()}`}
            >
              {event.title}
            </div>
          </div>
        );
      })}
    </div>
  );
}
