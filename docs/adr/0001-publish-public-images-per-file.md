# Public images are approved per file and served only as public renditions

Superseded by ADR 0017 (MUS-790). An Object in the portal now shows its images as public renditions by default.

Publishing an Object does not publish its attachments. Each public image needs explicit approval and an approved public rendition; documents and files with unknown or restricted rights stay private by default. A missing rendition never falls back to the original file. We accepted the extra approval step because disclosing a rights-restricted or operational file is not reversible.
