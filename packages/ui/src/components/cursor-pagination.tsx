"use client";

import type * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";

type LoadMoreProps = {
  variant: "loadMore";
  countLabel: React.ReactNode;
  isDone: boolean;
  onLoadMore: () => void;
  loadMoreLabel?: string;
  className?: string;
};

type NextPrevProps = {
  variant: "nextPrev";
  countLabel: React.ReactNode;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
};

export type CursorPaginationProps = LoadMoreProps | NextPrevProps;

export function CursorPagination(props: CursorPaginationProps) {
  if (props.variant === "loadMore") {
    const {
      countLabel,
      isDone,
      onLoadMore,
      loadMoreLabel = "Load more",
      className,
    } = props;
    return (
      <div
        className={cn(
          "flex items-center justify-between border-t border-white/10 bg-zinc-950 px-6 py-3 text-xs text-zinc-500",
          className,
        )}
      >
        <div>{countLabel}</div>
        <div className="flex gap-2">
          {!isDone && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              className="h-7 border-white/10 bg-zinc-900/60 text-xs text-zinc-200 hover:bg-zinc-900 hover:text-zinc-100"
            >
              {loadMoreLabel}
            </Button>
          )}
        </div>
      </div>
    );
  }
  const {
    countLabel,
    canPrev,
    canNext,
    onPrev,
    onNext,
    prevLabel = "Previous",
    nextLabel = "Next",
    className,
  } = props;

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-white/10 bg-zinc-950 px-6 py-3 text-xs text-zinc-500",
        className,
      )}
    >
      <div>{countLabel}</div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!canPrev}
          className="h-7 border-white/10 bg-zinc-900/60 text-xs text-zinc-200 hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
        >
          {prevLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!canNext}
          className="h-7 border-white/10 bg-zinc-900/60 text-xs text-zinc-200 hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
