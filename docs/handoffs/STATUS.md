# MUS-610 ticket status

Pipeline: design (Claude Opus) → implement (GPT 6.1 or Grok 4.7) → review (different provider) → merge in dependency order. One fresh thread per ticket and stage; handoff files in `docs/handoffs/` are the memory between stages. Max 2 running threads per provider. On a usage or rate limit: stop that thread, no retry, ask Marius.

Schema merge chain (sequential): MUS-624 → MUS-623 → MUS-627 → MUS-630 → MUS-631 → MUS-642 → MUS-645. Parallel: MUS-625, MUS-639, MUS-648 (design may move them into the chain).

| Ticket | Stage | Provider | Thread | Next action |
|---|---|---|---|---|
| MUS-624 disposal stages | implement (finish) | GPT 6.1 medium | [thread](t3-thread://v1/da5fe53f-50e6-45df-b288-335fc9bb981d/mcp%3A5619d6b5-a49f-41f4-af85-41951d5cec97) | then review on Grok 4.7; merge first in the chain |
| MUS-655 account recovery | implement (finish) | Grok 4.7 high | [thread](t3-thread://v1/da5fe53f-50e6-45df-b288-335fc9bb981d/mcp%3A0956e844-06d5-4592-a47a-5926ea8c94ac) | then review on GPT 6.1 |
| MUS-627 condition assessments | design | Claude Opus medium | [thread](t3-thread://v1/da5fe53f-50e6-45df-b288-335fc9bb981d/mcp%3A1a268771-ec79-436b-931d-f1d2d2da14b7) | then implement on GPT 6.1 or Grok 4.7 |
| MUS-623 draft-to-accession intake | queued: design | — | — | after MUS-624 merges |
| MUS-625 identifier search | queued: single task | — | — | unblocks MUS-626 |
| MUS-630 exhibition participation | queued: design | — | — | chain after MUS-627 |
| MUS-631 collection group membership | queued: design | — | — | chain after MUS-630 |
| MUS-639 export artifacts | queued: design | — | — | parallel |
| MUS-642 parties | queued: design | — | — | chain after MUS-631 |
| MUS-645 valuation and insurance | queued: design | — | — | chain after MUS-642 |
| MUS-648 vocabulary and capabilities | queued: design | — | — | parallel |
| MUS-618 Tuya adapter | deferred | — | — | deferred by Marius |
| MUS-611 612 613 614 615 616 617 619 620 621 622 628 637 | merged | — | — | in `codex/mus-610-integration` |
