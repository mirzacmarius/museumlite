# Coding standards

Read during review, not implementation. Only judgement calls belong here; anything a linter, hook or CI job can check mechanically belongs in that check instead.

## Scheduled work must be tested to its stored outcome

A mutation or action that schedules work (`ctx.scheduler.runAfter`, `runAt`, or a workflow step) whose result is persisted needs a test that drains the scheduler and then asserts the stored outcome through a public query:

```ts
vi.useFakeTimers();
await t.mutation(internal.media.generateThumbnail, { mediaId });
await t.finishAllScheduledFunctions(() => vi.runAllTimers());
const [media] = await t.query(api.media.list, { collectionId });
expect(media.uploadStatus).toBe("completed");
```

Asserting only the state right after scheduling is not enough, and neither is a comment promising the scheduled job "will update the record". In MUS-610, `generateThumbnail` left media stuck in `processing` because the action never wrote its result back, and the existing test approved the media before the scheduled job ran. Flag scheduled work whose persisted result no test observes after draining.

See `packages/backend/tests/webhooks.test.ts` and `packages/backend/tests/collectionManagerRole.test.ts` for existing examples.

## User-recoverable backend failures are coded ConvexErrors

In new or changed backend code, a failure the user can fix (a conflict, a stale selection, a disabled module) throws `ConvexError` with a stable `code`, and the UI maps that code to translated copy:

```ts
throw new ConvexError({ code: "TYPE_DETAILS_MISMATCH" });
```

Production redacts a plain `Error` to "Server Error", so its message never reaches the user, and raw server text is untranslated anyway. In MUS-632, handoff conflicts had to be reworked into coded errors for this reason. See `apps/app/src/app/[locale]/(dashboard)/objects/_components/object-type-details/use-object-draft-error-message.ts` for the UI side. Leave genuine bugs and invariant violations as plain errors, and do not flag untouched legacy code.

## Sorts on non-unique fields need a unique tie-breaker

A list or query result sorted by a field that can repeat (`createdAt`, `name`, `status`) breaks ties with `_creationTime` or `_id`, so equal values keep a deterministic order. In MUS-642, `partyLinks.listForTarget` sorted by `createdAt` alone, and links created in the same millisecond came back in varying order and made a test flaky.
