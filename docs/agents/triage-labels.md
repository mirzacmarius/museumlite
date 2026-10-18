# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual Linear vocabulary used in this repo.

| Label in mattpocock/skills | Linear status / label in MUS                         | Meaning                                  |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `needs-triage`             | Status: `Backlog`                                    | Maintainer needs to evaluate this issue  |
| `needs-info`               | Status: `Backlog`; optional label: `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent`          | Status: `Todo`; optional label: `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | Status: `Todo`; optional label: `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | Status: `Canceled`                                   | Will not be actioned                     |

## Notes

- All five labels exist on the MUS team (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Apply the label together with the status in the table, and remove the previous role's label when an issue moves on.
- When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the matching status and label from this table.
- Do not create duplicate labels if the team later adds equivalent labels with different names; update this file instead.
- Prefer existing type and area labels such as `Bug`, `Feature`, `Improvement`, `Task`, `Docs`, and `module/...`.
