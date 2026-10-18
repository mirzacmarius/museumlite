---
name: nextjs-convex-role-guards
description: >
  Next.js + Convex role-based access control. Use when implementing role guards, admin routes, protected layouts, Next.js middleware, JWT claims, or Convex auth role enforcement. Triggers on "layout guard", "role check", "protect route", "admin only", "403 forbidden", "authorization wrapper", "proxy.ts", "middleware.ts", or "customClaims". Enforces edge authorization, JWT role claims, and backend validation.
---

# Next.js + Convex Role Guards

## In MuseumLite

This repository does not follow this skill's pattern; its own access rules win. A Role belongs to an Organization membership (`userOrganizations.roleId`), not to the user, so a single `role` claim in the JWT cannot describe it. Access is one Capability matrix (`docs/adr/0004-capability-matrix-governs-access.md`, `GLOSSARY.md` "Access"): `packages/backend/convex/utils/capabilities.ts` declares it, pages read it through `CapabilityGuard`, and backend gates call `requireCapability` / `requirePermission`. `apps/app/src/proxy.ts` only checks sign-in and locale.

So here: do not add `customClaims` roles, do not gate staff areas by role in `proxy.ts`, and do not remove `CapabilityGuard` from pages. Use this skill only for its principle that Convex functions are the security boundary and the edge is UX. A change that would move access decisions to the edge is an ADR change; raise it with Marius first.

Client-side layout guards are the wrong abstraction for RBAC. They thrash preserved Next.js layouts, add a JS and data waterfall, and leak protected UI before auth resolves. Enforce role access at the Edge with JWT claims, keep the React tree pure, and mirror the real check in Convex mutations and queries.

This skill enforces edge middleware gating, short-lived role claims, and backend authorization as the source of truth.

## DO / DON'T Quick Reference

| DO (Modern Standard) | DON'T (Anti-Pattern) | Why |
|---|---|---|
| Inject `role` into Convex JWT `customClaims` | Fetch the user document in client guards | The claim travels with the token, so the Edge can decide instantly without a DB round-trip. |
| Gate protected routes in `src/proxy.ts` or `src/middleware.ts` | Wrap protected layouts in a client-side `<RoleGuard>` | Middleware blocks unauthorized users before React loads, avoiding layout remounts and UI flashes. |
| Keep protected layouts as pure UI shells | Put auth logic in `(dashboard)/layout.tsx` | Layout guards force client-side re-evaluation on navigation and break the preserved layout model. |
| Recheck roles in Convex backend functions | Trust middleware as the only security layer | Middleware is UX and edge performance, not authorization. Backend checks stop direct API abuse. |

## Execution Protocol

When instructed to protect a route or implement role-based access:

### 1. Inject the Role Claim (Convex Backend)
Add `customClaims` in `convex/auth.ts` so the session JWT carries the user's role. Keep the JWT short-lived so role changes do not linger.

```ts
import { convexAuth } from '@convex-dev/auth/server';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [/* ... */],
  jwt: {
    durationMs: 15 * 60 * 1000,
    customClaims: async (ctx, { userId }) => {
      const user = await ctx.db.get(userId);
      return { role: user?.role ?? 'user' };
    },
  },
});
```

### 2. Intercept at the Edge
Read the role claim in `src/proxy.ts` or `src/middleware.ts`. Use local JWT decoding only. Do not query Convex from middleware.

```ts
function decodeJwtClaims(token: string | undefined): { role?: string } | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isPublic = isPublicPage(request);
  const isAuthenticated = await convexAuth.isAuthenticated();
  const token = await convexAuth.getToken();
  const claims = decodeJwtClaims(token);
  const role = claims?.role;

  if (isPublic && isAuthenticated && role === 'admin') {
    return nextjsMiddlewareRedirect(request, '/dashboard');
  }

  if (!isPublic && !isAuthenticated) {
    return nextjsMiddlewareRedirect(request, '/login');
  }

  if (!isPublic && isAuthenticated && role && role !== 'admin') {
    return nextjsMiddlewareRedirect(request, '/login?forbidden=1');
  }
});
```

### 3. Strip the React Guard
Remove client-side `<RoleGuard>` wrappers from protected layouts like `src/app/(dashboard)/layout.tsx`. Leave only the UI shell.

### 4. Mirror Authorization in Convex
Every privileged query or mutation must still enforce the role check server-side. Middleware blocks bad UX; Convex blocks bad actors.

## The Edge Case

* JWT claims are stale until refresh. If role changes must take effect immediately, force session refresh or revoke the session.
* Middleware is not the security boundary. Never treat Edge redirects as authorization for Convex data or actions.
* If a page is public but contains isolated admin controls, guard the controls, not the whole route.
