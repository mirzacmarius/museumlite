# Implementation status

The audit, published specification and ticket drafts are historical planning records. Their statements that implementation is not yet approved describe publication time.

The user subsequently invoked `implement-spec` and explicitly instructed implementation on one integration branch through the in-scope task graph. Work proceeds on `codex/mus-610-integration`, with isolated ticket branches and verification before integration.

## Scope adjustment

- MUS-618: Tuya model-specific adapter and live sender cutover deferred by the user. Keep flagged; do not advertise vendor connectivity.
- MUS-617: Generic authenticated environmental-device receiver remains in scope.
- Production deployment, live migration and actual device credential provisioning are not approved by this implementation instruction.

## Review workflow

Locally verified ticket implementations are handed off in Linear as In Review with concrete review checklists. They are not marked Done before human review. Integration progress is distinct from institutional rollout approval.

## Accepted identifier policy (MUS-619)

The user explicitly accepted new primary museum identifiers as unique within each organization and register. Catalog and accession registers may reuse a number. Existing historical strings and duplicate entries remain permanent evidence; no automatic renumbering, deletion or identifier-based identity merge is authorized. Institution-configured numbering formats remain in effect.

MUS-619 implements one server policy for direct catalog/accession, object drafts, publication and import assignment. Additive keys use Unicode NFC, surrounding-space trimming and lowercase matching; punctuation and leading zeros remain significant. These keys never replace the original identifier. Historic alternate references remain evidence rather than new primary assignments. Staff can build the missing index in bounded rerunnable batches and record conflict review acknowledgements without making a conflicted number available for reuse. Large incomplete legacy indexes block new assignments until indexed; rollout requires an authorized institution review. No live backfill or production deployment was performed.

An unpublished pending accession can explicitly select a separate intended catalog number, with an audit entry and publication-time uniqueness recheck. This recovers catalog conflicts without replacing the permanent accession identifier or merging identities. Published catalog identifiers remain permanent.

## Continuation verification — 6 October 2026

MUS-613, MUS-614, MUS-616, MUS-619 and MUS-637 were resumed from the existing integration branch. The umbrella remains in progress; ticket review does not authorize production rollout.

- MUS-614: Sharp must be externalized in the backend Convex configuration and visible in the backend workspace's `node_modules`. The existing postinstall dependency-link helper now handles both TypeScript and Sharp without changing Bun's workspace dependency topology. A fresh isolated local deployment generated a real JPEG rendition, exposed it through the anonymous object projection, and served it with HTTP 200. Unpublishing removed the projection and the old rendition returned HTTP 404. The earlier local Sharp executor limitation is resolved for this packaging path.
- MUS-619: the identifier controls retain native forms and use async form actions. Isolated browser QA indexed historical catalog identifiers and selected a separate intended catalog number without changing the permanent accession number.
- MUS-637: the schedule UI separates creation, schedule controls and run history, with stable browser-timezone selection. Isolated browser QA reran an existing Europe/Bucharest schedule, downloaded its stored operational KPI JSON, verified "Not delivered", and paused/resumed the schedule.
- MUS-616: additional indirect cleanup guards protect orphaned documentary, commentary and audit evidence. The organization deletion lifecycle's own audit entries are distinguished from permanent evidence so ordinary library deletion can still progress. Bounded audit inspection fails closed when its review limit is reached.

For concurrent local app QA, `LOCAL_QA=1` selects `.next/local-qa` rather than the normal build directory. Always provide explicit loopback `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` values; the ordinary development environment may target a cloud deployment.

No production deployment or live migration was performed. A local Convex diagnostic command changed the symlinked backend environment file; its deployment and URLs were restored from the unchanged root environment. Further local verification used guarded loopback deployment commands.

Final integration verification: `bun run lint`, `bun run typecheck:all` and `bun run test` passed (1,160 backend tests and 90 app tests). Independent review confirmed the retention correction and found no remaining blocker in the changed identifier, KPI or media behavior. The full `bun run react-doctor` warning gate still fails, with 18 app warnings in broader integrated workflows and design heuristics, including the explicitly required black theme. This is an outstanding umbrella verification gap; the program and draft PR are not complete or ready to merge.
