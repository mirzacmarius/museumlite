# Plan 012: Align marketing claims with the shipped product, and deliver Dublin Core import

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e3f1d1a..HEAD -- apps/web/src/app/\(marketing\)/features/page.tsx apps/web/src/components/marketing/home/pillars.tsx packages/backend/convex/utils/dublinCore.ts packages/backend/convex/imports.ts apps/app/src/app/[locale]/\(dashboard\)/settings/data`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (Part A is S and standalone-valuable; do it even if Part B stalls)
- **Effort**: S (Part A) + M (Part B)
- **Risk**: LOW (Part A) / MED (Part B — new parser on an import path)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6e3f1d1a`, 2026-06-12

## Why this matters

The marketing site promises capabilities with zero implementation: IIIF imagery (twice),
authority reconciliation, sensor ingest, risk scoring, MARC import, reading rooms, and
custom portal domains. None of these strings or features exist in `apps/app` or
`packages/backend/convex` (repo-wide search; the only "iiif" hit is a Met-API seed
script URL). Prospects who buy against the features page will hit the gap in week one.
Part A rewrites the claims to match what actually shipped — which is substantial and
doesn't need inflating. Part B converts one aspirational claim into a real feature at
low cost: Dublin Core **import**. The export half already exists (objects export as
Dublin Core/Spectrum XML via `imports.ts`), and a `fromDublinCore` mapping function
already exists but is used only by its own unit test — import is the missing half of a
round-trip the code almost supports.

## Current state

### Part A — marketing claims

- `apps/web/src/app/(marketing)/features/page.tsx` — three module arrays with the
  overclaims:

```21:30:apps/web/src/app/(marketing)/features/page.tsx
const collectionModules: FeatureModule[] = [
  {
    title: "Object Catalog",
    desc: "Museum-grade records with provenance chains, condition history, IIIF imagery and authority reconciliation.",
    items: [
      "Versioned revisions",
      "Bulk accession import",
      "Linked agents & places",
    ],
  },
```

```52:68:apps/web/src/app/(marketing)/features/page.tsx
const conservationModules: FeatureModule[] = [
  {
    title: "Conservation",
    desc: "Treatments, environmental readings and risk flags — tied to the object record your team already trusts.",
    items: ["Treatment dossiers", "Sensor ingest", "Risk scoring"],
  },
  {
    title: "Library & Research",
    desc: "Catalogue holdings, patrons, circulation, and acquisitions for the institutional library.",
    items: ["MARC import", "Self-checkout", "Reading rooms"],
  },
  {
    title: "Public Portal",
    desc: "Publish a public catalogue with embargo controls and editorial pages when you are ready.",
    items: ["Custom domains", "SEO-ready pages", "IIIF imagery"],
  },
];
```

- `apps/web/src/components/marketing/home/pillars.tsx:11` — "…and IIIF-ready media."
- What actually ships (verified): provenance/condition fields, bulk CSV import/export
  with Dublin Core + Spectrum **export**, barcode scanning (`/scan` route), full
  circulation/fines/acquisitions, ISBN lookup, slug-based public portal with SEO
  metadata, conservation treatments with environmental data fields (manual entry).

### Part B — Dublin Core import

- `packages/backend/convex/utils/dublinCore.ts` — exports `toDublinCore` (55),
  `fromDublinCore` (149, maps `DublinCoreMetadata` → `Partial<Doc<"collections">>`),
  `toDublinCoreXML` (229), `collectionsToDublinCore` (302). **There is no XML → 
  `DublinCoreMetadata` parser** — that's the piece to build.
- `packages/backend/convex/imports.ts` — `exportObjectsWithFormat` /
  `exportAccessionsWithFormat` (~line 1331-1436) support `csv/json/xml/dublincore/spectrum`
  formats; batch import exists for objects/accessions/locations/accounts/loans via
  `createImportJob` + `import<Entity>Batch`.
- `apps/app/src/app/[locale]/(dashboard)/settings/data/data-import-tab.tsx` — import UI,
  currently `accept=".csv"` (line 100); type selector at line 63; the client logic is in
  `_components`-adjacent `use-data-import.ts` (`createImportJob` + `importObjectsBatch`
  etc.). Read both before changing.
- Tests: `packages/backend/tests/utils/dublinCore.test.ts` (unit tests for the existing
  mapping functions — the pattern to extend) and `packages/backend/tests/importFormats.test.ts` /
  `exportFormats.test.ts` (real format tests).
- Runtime constraint: this code runs in the Convex default runtime — **no `DOMParser`,
  no Node `xml2js`**. The parser must be a small self-contained string parser. The XML
  you must parse is exactly what `toDublinCoreXML` emits: flat `oai_dc`-style elements
  (`<dc:title>…</dc:title>` etc.), no nesting. Read `toDublinCoreXML` first — the
  import parser's contract is "round-trips our own export."

## Commands you will need

| Purpose   | Command (repo root unless noted)                       | Expected on success |
|-----------|--------------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                         | exit 0              |
| Typecheck | `bun run typecheck`                                    | exit 0              |
| Tests     | `cd packages/backend && bunx vitest run dublinCore importFormats` | all pass |
| All tests | `cd packages/backend && bun test:once`                 | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- Part A: `apps/web/src/app/(marketing)/features/page.tsx`,
  `apps/web/src/components/marketing/home/pillars.tsx`
- Part B: `packages/backend/convex/utils/dublinCore.ts` (add `fromDublinCoreXML`),
  `packages/backend/convex/imports.ts` (accept Dublin Core XML for objects import),
  `apps/app/src/app/[locale]/(dashboard)/settings/data/data-import-tab.tsx` and its
  `use-data-import.ts` (accept `.xml` for objects),
  `packages/backend/tests/utils/dublinCore.test.ts` (extend),
  `packages/backend/tests/importFormats.test.ts` (extend)

**Out of scope** (do NOT touch):
- Other marketing pages (`pricing`, homepage hero, etc.) beyond the two files above.
  If you spot more overclaims, list them in your report; don't fix.
- MARC, IIIF, OAI-PMH, authority control, custom domains — explicitly **not** built here.
- Spectrum XML **import** (export-only remains; note as follow-up).
- Dublin Core import for any entity other than objects.

## Git workflow

- Branch: `advisor/012-marketing-and-dc-import`
- Conventional commits; Part A example: `fix(web): align feature claims with shipped product`;
  Part B example: `feat(imports): Dublin Core XML import for objects`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step A1: Rewrite the overclaiming copy

In `features/page.tsx`, make exactly these replacements (keep tone and length):

| Location | Current | Replace with |
|---|---|---|
| Object Catalog `desc` | "…condition history, IIIF imagery and authority reconciliation." | "…condition history, rich media, and linked agents and places." |
| Conservation `items` | `["Treatment dossiers", "Sensor ingest", "Risk scoring"]` | `["Treatment dossiers", "Environmental readings", "Condition alerts"]` |
| Conservation `desc` | "Treatments, environmental readings and risk flags…" | "Treatments, environmental readings and condition alerts…" |
| Library `items` | `["MARC import", "Self-checkout", "Reading rooms"]` | `["ISBN lookup", "Barcode circulation", "Holds & fines"]` |
| Public Portal `items` | `["Custom domains", "SEO-ready pages", "IIIF imagery"]` | `["Branded portal pages", "SEO-ready pages", "High-res imagery"]` |

In `pillars.tsx:11`, change "IIIF-ready media" to "rich media".

If Part B lands (below), you may add "Dublin Core import/export" to the Object
Catalog `items` — only after B's done criteria pass.

**Verify**: `rg -i 'IIIF|MARC|sensor ingest|risk scoring|reading rooms|custom domains|authority reconciliation' apps/web/src` → no matches. `bun run lint` → exit 0; `bun run typecheck` → exit 0.

### Step B1: `fromDublinCoreXML` parser

In `utils/dublinCore.ts`, add and export:

```typescript
export function fromDublinCoreXML(xml: string): DublinCoreMetadata[]
```

- Parse the flat element structure `toDublinCoreXML` produces: per record, extract each
  `<dc:NAME>VALUE</dc:NAME>` pair; repeated elements (e.g. multiple `<dc:subject>`)
  become arrays, matching how `DublinCoreMetadata` types them. Decode the XML entities
  that `toDublinCoreXML` encodes (read its escaping logic and invert exactly that set).
- Handle both a single-record document and a multi-record wrapper (check what
  `collectionsToDublinCore` + `toDublinCoreXML` produce for N records; if exports are
  always one document per record, accept a single record and return a 1-element array).
- Malformed input returns `[]` or throws a descriptive `Error` — pick one, document it
  in the function's JSDoc, and be consistent.

**Verify**: round-trip unit test (Step B3 test 1) passes:
`cd packages/backend && bunx vitest run dublinCore` → all pass.

### Step B2: Wire the import path

In `imports.ts`, find the objects batch import (`importObjectsBatch` or equivalent —
read `use-data-import.ts:26-28` to confirm the exact function the UI calls). Add a
format-aware entry point: either a `format: v.optional(v.union(v.literal("csv"), v.literal("dublincore")))`
arg on the existing batch mutation, or a thin `importObjectsDublinCore` mutation that
maps `fromDublinCoreXML` → `fromDublinCore` → the same row-shape the CSV path feeds
into the shared insert logic. Prefer whichever shape mirrors how the export side
branches on format (`exportObjectsWithFormat`) — match the existing pattern.

In `data-import-tab.tsx` / `use-data-import.ts`: when `importType === "objects"`,
`accept=".csv,.xml"`; on `.xml` files route to the Dublin Core path. Other entity
types keep `.csv` only.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step B3: Tests

Extend `tests/utils/dublinCore.test.ts`:
1. **Round-trip**: object → `toDublinCore` → `toDublinCoreXML` → `fromDublinCoreXML`
   → `fromDublinCore` → fields (title, tags/subject, description, identifiers) survive.
2. Entity decoding: a title containing `& < > "` round-trips.
3. Malformed XML behaves per the documented contract.

Extend `tests/importFormats.test.ts` (follow its existing structure):
4. End-to-end: import a Dublin Core XML document via the new path → a collections row
   exists with the mapped title/org.

**Verify**: `cd packages/backend && bunx vitest run dublinCore importFormats` → all pass, ≥4 new tests.

### Step B4: Full gates

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0;
`cd packages/backend && bun test:once` → all pass.

## Test plan

Covered in B3. Pattern files: `packages/backend/tests/utils/dublinCore.test.ts`,
`packages/backend/tests/importFormats.test.ts`.

## Done criteria

- [ ] `rg -i 'IIIF|MARC import|sensor ingest|risk scoring|reading rooms|custom domains|authority reconciliation' apps/web/src` → no matches
- [ ] `grep -n "fromDublinCoreXML" packages/backend/convex/utils/dublinCore.ts` → exported function exists
- [ ] Round-trip test (export → import) passes
- [ ] Objects import UI accepts `.xml`; other types unchanged
- [ ] `bun run lint`, `bun run typecheck` exit 0; `bun test:once` passes
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `toDublinCoreXML` produces nested or namespaced-beyond-`dc:` structure that a flat
  string parser can't handle in ~100 lines — report; pulling in an XML dependency is a
  maintainer decision.
- The objects batch-import path in `imports.ts` can't accept a second format without
  restructuring its job/validation pipeline — ship Part A alone and report B as blocked.
- Marketing copy in the two files differs from the excerpts (drifted).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Part A is a holding position: if IIIF/MARC/custom domains are ever built, restore the
  claims then. Keep `docs/` honest the same way.
- Spectrum **import** is the natural next asymmetry to close (same wiring as B2, new
  parser); also deaccessions are export-only in Settings → Data (separate finding).
- Reviewer focus (Part B): the parser's entity decoding must exactly invert the
  export's encoding — the round-trip test is the contract; and imported objects must
  carry the importing org's `organizationId` (tenant isolation), which test 4 should assert.
