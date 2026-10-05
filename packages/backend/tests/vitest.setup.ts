import { vi } from "vitest";

vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");

type AsOptions = { as: string };

function isAsOptions(value: unknown): value is AsOptions {
  if (value === null || typeof value !== "object") return false;
  return "as" in value && typeof (value as { as?: unknown }).as === "string";
}

vi.mock("convex-test", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex-test")>();

  const convexTest: typeof actual.convexTest = ((schema, modules) => {
    const t = actual.convexTest(schema, modules);

    const wrapAs =
      <TRef, TArgs extends unknown[], TResult>(
        base: typeof t,
        call: (bound: typeof t, ref: TRef, args: TArgs) => Promise<TResult>,
      ) =>
      async (ref: TRef, ...args: TArgs) => {
        const lastArg = args.length > 0 ? args[args.length - 1] : undefined;
        if (isAsOptions(lastArg)) {
          const withoutOptions = args.slice(0, -1) as TArgs;
          const authed = base.withIdentity({
            subject: `${lastArg.as}|session-1`,
            issuer: "https://example.test",
          });
          return await call(authed, ref, withoutOptions);
        }
        return await call(base, ref, args);
      };

    const query = wrapAs(t, async (bound, ref, args) => {
      return await bound.query(ref as never, ...(args as never));
    });
    const mutation = wrapAs(t, async (bound, ref, args) => {
      return await bound.mutation(ref as never, ...(args as never));
    });
    const action = wrapAs(t, async (bound, ref, args) => {
      return await bound.action(ref as never, ...(args as never));
    });

    return {
      ...t,
      query: query as typeof t.query,
      mutation: mutation as typeof t.mutation,
      action: action as typeof t.action,
    };
  }) as typeof actual.convexTest;

  return { ...actual, convexTest };
});
