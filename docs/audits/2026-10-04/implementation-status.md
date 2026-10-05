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
