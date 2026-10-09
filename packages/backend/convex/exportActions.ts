"use node";

import { createHash } from "node:crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { MAX_CHUNK_BYTES, MAX_EXPORT_BYTES } from "./utils/exportContract";
import { encodeRows } from "./utils/exportEncoding";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export const process = internalAction({
  args: { jobId: v.id("exportJobs"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const job: Doc<"exportJobs"> | null = await ctx.runMutation(
        internal.exports.claim,
        args,
      );
      if (!job) return null;
      if (!job.sourceDone) {
        let page: {
          rows: Record<string, unknown>[];
          cursor: string | null;
          done: boolean;
          scanned: number;
        };
        if (job.source.kind === "objects" || job.source.kind === "register") {
          page = await ctx.runQuery(internal.exports.sourcePage, args);
        } else {
          const source: {
            entries: Record<string, unknown>[];
            nextCursor?: string;
            isDone: boolean;
            totalCount: number;
          } = await ctx.runQuery(internal.auditLog.exportPageForJob, {
            organizationId: job.organizationId,
            creatorId: job.creatorId,
            ...job.source.filters,
            actionMatch: "exact",
            asOf: job.asOf,
            paginationOpts: {
              numItems: 50,
              cursor: job.cursor,
              maximumRowsRead: 50,
              maximumBytesRead: 512 * 1024,
            },
          });
          page = {
            rows: source.entries.map((row) => ({
              ...row,
              capturedAt: Date.now(),
            })),
            cursor: source.nextCursor ?? null,
            done: source.isDone,
            scanned: source.totalCount,
          };
        }
        const bytes = new TextEncoder().encode(
          encodeRows(page.rows, job.source, job.format, job.checkpoint === 0),
        );
        if (bytes.length > MAX_CHUNK_BYTES)
          throw new Error(
            `An export page exceeds ${MAX_CHUNK_BYTES / 1024} KiB. Reduce selection or shorten oversized record fields.`,
          );
        const storageId = bytes.length
          ? await ctx.storage.store(
              new Blob([bytes], { type: "application/octet-stream" }),
            )
          : undefined;
        let committed = false;
        try {
          committed = await ctx.runMutation(internal.exports.commitChunk, {
            ...args,
            checkpoint: job.checkpoint,
            storageId,
            rows: page.rows.length,
            bytes: bytes.length,
            sha256: hash(bytes),
            cursor: page.cursor,
            done: page.done,
            scanned: page.scanned,
            capturedAt: Date.now(),
          });
        } finally {
          if (!committed && storageId) await ctx.storage.delete(storageId);
        }
        return null;
      }
      const parts: Uint8Array<ArrayBuffer>[] = [];
      let after = job.finalizeAfter;
      let totalRows = 0,
        totalBytes = 0,
        leafChunks = 0;
      const digest = createHash("sha256");
      const chunks: Array<{
        sequence: number;
        storageId?: Id<"_storage">;
        rows: number;
        bytes: number;
        sha256: string;
        leafChunks: number;
      }> = await ctx.runQuery(internal.exports.finalizePage, args);
      if (!chunks.length && job.finalizeInputCount !== 0)
        throw new Error("Missing export consolidation part");
      for (const chunk of chunks) {
        if (chunk.sequence !== after + 1 || !chunk.storageId)
          throw new Error("Missing export chunk");
        const blob = await ctx.storage.get(chunk.storageId);
        if (!blob || blob.size !== chunk.bytes)
          throw new Error("Export chunk size mismatch");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (hash(bytes) !== chunk.sha256)
          throw new Error("Export chunk checksum mismatch");
        totalBytes += bytes.length;
        if (totalBytes > MAX_EXPORT_BYTES)
          throw new Error(
            `Export exceeds ${MAX_EXPORT_BYTES / 1024 / 1024} MiB. Reduce selection and create a new export.`,
          );
        totalRows += chunk.rows;
        leafChunks += chunk.leafChunks;
        digest.update(bytes);
        parts.push(bytes);
        after = chunk.sequence;
      }
      const storageId = await ctx.storage.store(
        new Blob(parts, {
          type:
            job.format === "csv"
              ? "text/csv;charset=utf-8"
              : "application/x-ndjson",
        }),
      );
      let committed = false;
      try {
        committed = await ctx.runMutation(internal.exports.complete, {
          ...args,
          storageId,
          sha256: digest.digest("hex"),
          bytes: totalBytes,
          rows: totalRows,
          chunks: leafChunks,
          level: job.finalizeLevel,
          after: job.finalizeAfter,
          inputAfter: after,
        });
      } finally {
        if (!committed && storageId) await ctx.storage.delete(storageId);
      }
    } catch (error) {
      await ctx.runMutation(internal.exports.fail, {
        ...args,
        error:
          error instanceof Error
            ? error.message
            : "Export interrupted; retry available",
      });
    }
    return null;
  },
});
