# An Object in the portal shows its images as public renditions by default

Supersedes ADR 0001 (MUS-790). Under ADR 0001 an image became public only after staff cleared its rights and approved a rendition of it. Plain uploads have neither, so Objects in the public portal showed no images. Museums expect an Object in the portal to show its images.

Every image of an Object in the public portal is now public by default. The portal shows it as a public rendition, which is a JPEG at most 1600 px on its longer edge, turned upright, flattened onto white, and stripped of embedded metadata such as EXIF, GPS, IPTC, and XMP. The rendition is made from the image's current file when the image is uploaded, imported, published from an accession draft, or given a new version. The `backfillPublicRenditions` migration makes renditions for older images. The portal shows only renditions, and an image without a rendition is not shown.

These stay private:

- Files that are not JPEG, PNG, WebP, or TIFF images, and images filed in the document category.
- Images that staff hid from the portal.
- Images whose recorded rights forbid public display. That covers restricted rights, an internal-only, editorial-only, or custom license, a licensed image without a CC0 license, an expired license, usage restrictions, and a required acknowledgment, which the portal cannot show.

Unknown or missing rights, and orphan works, do not keep an image private.

Hiding an image, or recording rights that forbid public display, deletes its rendition, so a copied link stops working. When a license expires, a scheduled job deletes the rendition at the expiry time. Taking an Object out of the portal, or turning the portal off, stops listing its images but keeps their renditions, so a link copied while they were public keeps working. Images of Objects outside the portal also get renditions, so an Object that enters the portal shows its images at once. The migration hides an image if its last publication record before this change was an unpublish. After this change, showing, hiding, or approving an image stores the staff choice on the image, and the migration never overrides that choice.

Staff approval no longer decides publication. Approving a hidden image shows it again, like Show. Approval also lets staff offer a public download of an image's original file, which keeps the original's metadata. That download stays off until staff turn it on for that image. Approval keeps the ownership check from ADR 0001, which ADR 0016 also relies on for Licensed copies.

Considered and rejected:

- Serving the uploaded file until a rendition exists, because originals carry camera metadata and GPS coordinates at full resolution.
- Keeping images with unknown rights private until review, because the reporter's Objects would still show nothing.
- Making renditions only for Objects already in the portal, because an Object enters the portal through several paths, and a missed path would leave its images without a rendition.
- Folding approval into the automatic rendition now, because removing the approval fields needs its own schema migration. A follow-up can do it.
