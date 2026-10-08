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
