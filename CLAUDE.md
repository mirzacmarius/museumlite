# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a museum/gallery/library collection management system built as a monorepo using:

- **Convex** for backend (authentication, database, storage, background jobs, validated server actions)
- **Next.js 16** with App Router for frontend applications
- **Turborepo** for monorepo orchestration
- **Bun** as the package manager
- **Biome** for linting and formatting
- **TypeScript** throughout

## Commands

### Development

```bash
# Start everything in development mode
bun dev

# Start specific apps
bun dev:web    # Marketing site on port 3001
bun dev:app    # Main application on port 3000

# Backend development
cd packages/backend && bun dev  # Run Convex with tail logs
```

### Build & Quality

```bash
# Build all packages
bun build

# Linting and formatting
bun lint           # Run Biome linter across all packages
bun format         # Format code with Biome

# Type checking
bun typecheck      # Run TypeScript type checks

# Testing
bun run test       # Run all workspace tests (app + backend)

# Testing (from packages/backend)
bun test           # Run backend tests once (finite vitest run)
bun test:watch     # Run backend tests in watch mode
bun test:once      # Placeholder guard, then vitest run
```

### Convex Backend

```bash
# From packages/backend directory
npm run setup      # Initial Convex setup
npm run seed       # Seed database with initial data
bunx convex run init  # Initialize Polar products and seed
```

## Architecture

### Monorepo Structure

- **apps/app**: Main collection management application (port 3000)
- **apps/web**: Marketing/landing site (port 3001)
- **packages/backend**: Convex backend with all server functions, schema, and database logic
- **packages/ui**: Shared UI components (Shadcn-based)
- **packages/analytics**: OpenPanel analytics integration
- **packages/email**: React Email templates
- **packages/logger**: Shared logging utilities

### Backend Architecture (Convex)

The backend uses Convex for all server-side logic:

- **Multi-tenant**: Organizations with members and role-based permissions
- **Schema-driven**: Strongly typed database schema in `packages/backend/convex/schema.ts`
- **Modular features**: Each feature (accessions, loans, media, etc.) has its own module file
- **Auth**: Convex Auth with Google OAuth integration
- **Testing**: Uses convex-test library with Vitest

Key backend modules:

- `accessions.ts`: Artwork/item intake and management
- `assignments.ts`: Task assignments and workflows
- `media.ts`: Global media browser and storage
- `organizations.ts`: Multi-tenant organization management
- `accounts.ts`: User accounts and authentication

### Frontend Patterns

- **Server Components by default**: Minimize `use client` directives
- **Convex client**: Initialized in `convex-client-provider.tsx`
- **URL state**: Uses `nuqs` for search params state management
- **Internationalization**: Using next-international
- **Themes**: Dark/light mode with next-themes
- **Forms**: Tanstack Form with Zod validation

## Code Conventions

### TypeScript & Imports

- Use interfaces over types
- Avoid enums, use maps/unions instead
- Use functional components with TypeScript interfaces
- Follow existing import patterns in each module

### Convex Patterns

- Mutations return IDs or success indicators
- Queries use pagination helpers from convex-helpers
- Use validators (`v`) for all function arguments
- Test with convex-test library

### UI Components

- Use existing Shadcn components from `packages/ui`
- Follow mobile-first responsive design
- Use Tailwind CSS for styling
- Wrap client components in Suspense boundaries

### Error Handling

- Model expected errors as return values in Server Actions
- Use early returns and guard clauses
- Implement proper error logging
- Use error boundaries for unexpected errors

## Testing

Backend tests use Vitest with convex-test:

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
```

Run tests from `packages/backend` directory using `bun test`.

## Agent skills

### Issue tracker

Issues are tracked in Linear under the MuseumLite MUS team; agents may create issues directly in Linear and should pick up existing team-created issues from the MUS active board. See `docs/agents/issue-tracker.md`. When finishing Linear-delegated work, comment review steps on the issue and set status to **In Review** (never **Done**) — see `.cursor/rules/linear-delegation-handoff.mdc`.

Delegated handoffs must include a **Review checklist** on the issue (`MUS-485` pattern: grouped `- [ ]` steps with where to test in the app). Details: `.cursor/rules/linear-delegation-handoff.mdc`.

### Triage labels

Triage uses the MUS Linear statuses, with optional canonical labels only where a matching Linear label exists or is added later. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context domain documentation: see `docs/agents/domain.md` (optional `CONTEXT.md` and `docs/adr/` when present).
