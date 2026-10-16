# Staff can delete an Object's images; approval follows the accessions workflow

Refines ADR 0002 (MUS-794). Staff uploaded wrong or duplicate photos and had no way to remove them, because every media file counted as permanent evidence.

An Object's images can now be deleted from the edit form. Deleting removes the image for good: its original, thumbnail, edited versions, public renditions and their records. The portal stops showing it at once, and when it was the primary image, the Object's next image becomes primary. The audit log keeps who deleted which file and when, and a published intake's draft list drops the file.

When the Accessions approval workflow is on, deleting asks for approval. The image stays, marked as waiting, until someone who may approve the workflow's first step decides; by default that is the Collection Manager, and Administrators may approve any step. Without a configured first step, Administrators and Collection Managers decide. The request appears under Pending Your Approval. Approving deletes the image and rejecting keeps it. Requests stay as the record of the decision. When the workflow is off, a second warning says the deletion cannot be reversed, and confirming deletes the image at once. Requesting or deleting needs `media.delete`.

These stay permanent:

- Documents filed with an Object.
- Images cited by a condition assessment, provenance claim, incident, case task or reproduction request, because deleting them would erase that evidence.

Considered and rejected:

- Hiding deleted images instead of removing them, because the reporter asked for an irreversible deletion and an original keeps camera metadata and GPS coordinates.
- A new approval permission, because existing roles would need a data migration before anyone could approve.
