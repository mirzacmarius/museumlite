# A transfer's Removal is approved by the sender, and the transfer decides how it ends

MUS-842. When the sender approves a transfer to another Organization, the sender's register records a Removal: a Deaccession with method transfer. The transfer code used to write that Deaccession itself, numbered it `TR-<SLUG>-<milliseconds>` and gave it no search document, so the Removals board search never found it.

The Removals module (`deaccessions.ts`) now writes every Deaccession, the transfer's included:

- The sender's approval creates the Removal approved at once, numbered from the sender's Deaccession sequence (`DA-<ORG>-<YEAR>-<NNN>`) like any other Removal, with its search document and audit entry. The Object's status does not change yet. The approved Removal holds the Object, so no other Removal or transfer can start while the receiver decides.
- When the receiver accepts, the executed transfer closes the Removal. It stays approved as the record of the Object leaving.
- When the receiver declines, the Removal becomes rejected, with a note saying so. The Object never left, so nothing is restored, and the rejected Removal stays as the record of the attempt.

Existing transfer Removals keep their `TR-` numbers, because records are never renumbered (ADR 0002). The internal migration `migrations:backfillDeaccessionSearchDocuments` writes their missing search documents, run once after deploy. It replaces the public `deaccessions.backfillSearchDocuments`, which let any member who could read collections rewrite the search documents of the whole Organization in one transaction.

Considered and rejected:

- Keeping the Removal pending until the receiver accepts, because it would sit in the Removals approval column and on the Work board as waiting for the sender's approval, which it no longer is.
- Keeping `TR-` numbers for new transfer Removals, because they match nothing else on the Removals board.
