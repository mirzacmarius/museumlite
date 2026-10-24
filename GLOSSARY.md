# MuseumLite

Software for museum staff to manage collections, objects, locations, people, documentation and workflows. Museums are the primary audience; library circulation is an optional module with its own semantics.

## Language

### Institutions and places

**Organization**:
The tenant responsible for an institution's records and its access policy.
_Avoid_: Account, institution (when you mean the tenant)

**Site**:
A physical or operational subdivision of an Organization. Sites do not narrow access today: every Capability is granted for the whole Organization.
_Avoid_: Building, branch

**Location**:
A physical place or container where an Object can be. An empty Location means unknown, never "loaned" or "returned".
_Avoid_: Room, shelf (as general terms)

### Collection records

**Object**:
The stable catalogued identity of a museum item. Its identity persists through loans, exhibitions, withdrawal and disposal.
_Avoid_: Item (reserved for library circulation), collection record

**Collection group**:
A curatorial grouping of Objects.
_Avoid_: Collection (ambiguous with the whole holdings)

**Party**:
A person or institution in a contextual relationship to the museum, such as donor, lender, depositor or staff member.
_Avoid_: Contact, donor (as an identity)

**Facet**:
A catalogue filter whose choices are the values recorded on the Organization's Objects (culture, period, condition, materials). A facet matches a whole recorded value, whatever its case.
_Avoid_: Free-text filter

**Bulk field edit**:
One change (set, clear, or find and replace) to one field of every Object in a selection or matching the catalogue's search and filters, previewed before it runs and written in bounded pages with an audit entry per Object.
_Avoid_: Mass update, batch edit

**Date made**:
When an Object was made, kept as staff wrote it and, when they structure it, as an EDTF date that wins over the text. Text in a recognised form ("c. 1850", "1850s", "before 1900", "500 BC") is read as a date; other text is shown as written and leaves the Object undated. The catalogue sorts and filters by the earliest and latest years of the date in effect, which are worked out and never stored on the Object (ADR 0021).
_Avoid_: Date created (it reads as when the record was made), production year

### Intake and permanence

**Entry**:
Receipt of an Object into institutional custody for a stated purpose. It may never result in an Acquisition.
_Avoid_: Check-in

**Entry number**:
The temporary identifier an Object carries from Entry until Accession; afterwards it stays in the Object's identifier history.
_Avoid_: Accession number (for unaccessioned property)

**Acquisition**:
The decision, with evidence, that establishes the institution's interest or title in an Object. Physical possession alone is not an Acquisition.
_Avoid_: Donation (one method among several)

**Accession**:
Controlled registration of accepted material into the permanent collection. Its identifier and history are permanent.
_Avoid_: Catalog entry, draft

**Custody**:
Accountable possession of an Object, including by external parties and in transit.
_Avoid_: Status, location

**Deaccession**:
Authorized removal of an Object from the permanent collection under institutional policy, separate from disposal and from physical exit.
_Avoid_: Delete, remove

**Withdrawal**:
Taking an Object, or an intake request a reviewer declined, out of routine views while its record is retained and restorable. It asserts neither a change of title nor disposal; a withdrawn intake was never accessioned, so it never produces a Deaccession.
_Avoid_: Delete, archive (when title or disposal is meant)

**Removal**:
Staff-facing umbrella for taking an Object out of the routine collection: a Deaccession (by sale, donation, transfer or destruction), a Withdrawal, or a move to another Organization. The Object's Remove or transfer button starts a sale, a move or a Withdrawal. Registration › Removals lists Deaccession and Withdrawal requests, and the Work board counts those waiting for the viewer's approval; a move is tracked as a move request.
_Avoid_: Deaccession (for the umbrella)

### Provenance

**Provenance claim**:
A recorded assertion about who held an Object, in what role, when and how, kept in its author's wording with its evidence and confidence. A correction supersedes a claim, a retraction ends it, and neither rewrites it. Contradictory claims are kept side by side for review.
_Avoid_: Ownership history (the legacy free-text list), provenance entry

**Partial date**:
A historical date known only to a day, month, year or decade, optionally circa, not after, not before, or uncertain. An Object's Date made also takes a year before Christ. It is never stored as a timestamp.
_Avoid_: Approximate timestamp

### Access

Access has independent dimensions: the Organization's Modules, its Entitlements, and the staff member's Role. A Capability names which of them it needs.

**Module**:
An optional area an Organization turns on or off in Settings › Modules, such as Library, Accounts or a collection type like Fine Art. Most Modules start off. Comments starts on, and turning it off hides the Comments tab on Objects and refuses new comments while keeping existing ones. Turning a Module on never grants an Entitlement. The Insurance Module only lists Insurance in navigation, because insurance records predate it.
_Avoid_: Add-on, integration (the legacy library integration also turns on the Library Module)

**Entitlement**:
A workflow included in the Organization's plan (Free, Pro or Enterprise), such as loans, exhibitions or compliance. Code calls it a feature.
_Avoid_: Module, feature flag

**Role**:
A named set of Permissions held by each staff member within one Organization.
_Avoid_: User type, group

**Permission**:
One action a Role allows, such as `loans.read` or `organization.manage_settings`.
_Avoid_: Right, scope

**Capability**:
A staff-facing area or command, with its canonical route, defined by the Module, Entitlement and Permissions it needs. When unavailable it names the first missing dimension: Module, then Permission, then Entitlement, so staff without access are never told to upgrade. Non-members are told nothing about an Organization.
_Avoid_: Feature (when the combination is meant)

### Work

**Case**:
A workflow record with its own approval history, such as a loan, transit record, exhibition, conservation treatment, accession, deaccession, move request, library acquisition request, documentation Finding, Inventory exception or Incident.
_Avoid_: Ticket, request (as a general term)

**Task**:
A unit of work waiting on a staff member, such as an installation task or an approval step on a Case.
_Avoid_: To-do, job

**Work board**:
The columns at the top of the Overview page that hold only Tasks and Cases waiting on the viewer to do, approve, review or verify. Activity feeds such as Cataloged by you show what the viewer already did, so they sit below the board and never become a column.
_Avoid_: Board (alone; a Board report is for an institution's governing board), dashboard, kanban

**Preparation recipe**:
An institution's list of next-step Tasks that an accepted intake, an approved loan or an approved exhibition suggests, such as cataloguing, photographing and assessing a newly accessioned Object. Each step names its owner, its due date relative to the Case, the steps it waits for and the evidence that shows it was done.
_Avoid_: Template, automation, workflow (approval workflows are separate)

**Suggested task**:
A Task a Preparation recipe created for one step of one accepted Case event. Repeating or correcting the event never adds a second one, and staff can dismiss and restore it. Completing it records nothing about custody, receipt, installation, title or condition.
_Avoid_: Automatic task, recommendation

**Incident**:
A Case recording damage, loss, theft or an emergency that affects Objects or Locations, from the first report through triage and response to its after-action review. A restricted Incident is visible only to coordinators, its reporter, its lead and its named responders.
_Avoid_: Event, alert (an Alert episode can raise an Incident), claim (an insurance claim is separate)

**Response plan**:
A Preparation recipe for Incidents. It guides a response only when a coordinator chooses it at triage; its steps fall due in hours from triage.
_Avoid_: Emergency plan (the institution's full emergency plan lives outside the app), playbook

### Documentation quality

**Documentation profile**:
An institution's rule for the documentation Objects of one type need at given stages, such as a photograph and an accepted condition assessment for paintings in the collection.
_Avoid_: Checklist, template

**Quality check**:
A bounded, resumable run that compares every collection record with the active Documentation profiles and the built-in checks. It records Findings and never changes a record.
_Avoid_: Audit, scan

**Finding**:
A documentation exception a Quality check detected (a duplicate identifier, missing documentation, an uncertain Party link or a broken reference), kept with the values the check found. It stays open until a later check no longer detects it or a reviewer accepts it as an exception with a reason. Repair work on it is a Task with the Finding as its Case.
_Avoid_: Issue, error, warning

**Object ID sheet**:
A one-page printout of an Object following the Object ID checklist (nine categories, photographs and a short description), ready to give the police, an insurer or a stolen-art register if the Object is lost or stolen. Categories the record lacks print as not recorded. The Object ID Documentation profile checks the same categories.
_Avoid_: Theft report (the sheet feeds one), identity card, passport

### Inventory

**Inventory session**:
A comparison of the Objects the records place in one Location, optionally with every Location below it, with what staff find there. The expected Objects are a snapshot taken when it starts. It ends reconciled when every Inventory exception is closed, or cancelled with its Observations kept.
_Avoid_: Stocktake, audit, scan (a scan is one Observation)

**Observation**:
Evidence that a staff member scanned or typed a label at a Location in an Inventory session's scope at a recorded time. It never moves an Object or changes its record.
_Avoid_: Sighting, check-in

**Inventory exception**:
A difference an Inventory session found when scanning finished: an expected Object not found, an Object found in another Location than recorded, an Object not expected there, or a label that names no Object. It closes when a reviewer records the move through the guarded movement command, or accepts it with a reason. Repair work on it is a Task with the exception as its Case.
_Avoid_: Discrepancy (in staff-facing copy), error

### Notifications

**Notification**:
A message to one staff member about an event in their Organization, shown in the notification center and, when they chose it, emailed. It reaches only current members who may read what it names.
_Avoid_: Message, alert (Alerts is one category)

**Notification category**:
Approvals, Reminders, Alerts, Tasks or System. Each staff member chooses per category whether they are notified at all and whether they are also emailed.
_Avoid_: Notification type (the specific event kind within a category)

**Notification intent**:
The record of one event that was notified about. Dispatching the same intent again notifies nobody, so each recipient hears about an event once.
_Avoid_: Notification (the per-recipient message)

**Digest**:
One email that groups a staff member's notifications from one Organization, sent daily or weekly at the local time they chose. When it is sent it lists only the notifications they may still read and still want emailed.
_Avoid_: Summary, newsletter

### Environmental monitoring

**Reading**:
One measurement of a Location's environment, from a probe of a registered device or a staff spot check, with the time it was observed and the time it arrived.
_Avoid_: Alert (a reading outside the thresholds is evidence, not an alert)

**Late reading**:
A probe's reading observed before the latest reading already received from that probe. It is kept as evidence but never changes the current condition or an Alert episode's state.
_Avoid_: Old reading, duplicate

**Alert episode**:
One sustained breach of a Location's environmental thresholds, from the first current Reading outside them until every source that showed it reads within them again, or a manager resolves it. Later Readings update it instead of raising new alerts; it notifies when it opens, escalates and recovers.
_Avoid_: Alert (for one Reading), incident

**Silent probe**:
A bound probe with no Reading observed in the last two hours. A silent probe is never shown as in range.
_Avoid_: Offline, healthy

### Library circulation

These terms belong to the optional Library Module and never describe museum Objects.

**Item**:
A catalogued library holding that Patrons borrow; each physical copy circulates on its own.
_Avoid_: Object, book (Items include other media)

**Patron**:
A person registered to borrow Items, recorded as an account of type patron.
_Avoid_: Borrower (a loans party), member, user

### Publication

**Public rendition**:
A derivative of one image's current file, at most 1600 px and without embedded metadata. It is made automatically and is the only form in which the public portal shows the image. An Object in the portal shows its images this way by default, but never its documents, its original files, images that staff hid, or images whose recorded rights forbid public display.
_Avoid_: Public image, published file

**Reproduction request**:
A Party's request to use one image of an Object for research or reproduction, with its purpose, rights evidence and decision. An approval delivers a Licensed copy under a version of the Terms of use until it expires or is revoked.
_Avoid_: Image order, permission request

**Licensed copy**:
The copy of an image made for one approved Reproduction request, without the original's metadata. It is the only file a requester receives and is never public.
_Avoid_: Derivative (in staff copy), original, public rendition

**Terms of use**:
An Organization's published conditions for Licensed copies. Each publication is a new version, and every approval keeps the version it was granted under.
_Avoid_: License (the rights status recorded on an image)

## Translations

The accepted word for each term in the app's other locales. Use it wherever English names the term, and inflect it as the sentence needs. `apps/app/src/locales/translations.test.ts` checks Object and Location, that an Accession is never translated as an Acquisition or an Entry, and that no locale calls an Object an item outside the Library Module.

| Term | Spanish | French | Norwegian | Romanian |
| --- | --- | --- | --- | --- |
| Object | objeto | objet | objekt | obiect |
| Collection group | grupo de colección | groupe de collection | samlingsgruppe | grup de colecție |
| Location | ubicación | emplacement | plassering | locație |
| Entry | entrada | entrée | innlevering | intrare |
| Acquisition | adquisición | acquisition | erverv | achiziție |
| Accession | accesión | accession | aksesjon | accesiune |
| Deaccession | baja | désaccession | deaksesjon | scoatere din colecție |
| Custody | custodia | garde | forvaring | custodie |
| Withdrawal | retirada | retrait | tilbaketrekking | retragere |
| Removal | retirada | retrait | fjerning | eliminare |
| Party | parte | partie | part | parte |
| Case | caso | dossier | sak | dosar |
| Task | tarea | tâche | oppgave | sarcină |
| Notification | notificación | notification | varsel | notificare |
| Incident | incidente | incident | hendelse | incident |

Norwegian uses _gjenstand_ for property received under an Entry, as Spanish uses _bien_ and Romanian _bun_; the Object recorded for it is still _objekt_.

Spanish and French use one word, _retirada_ and _retrait_, for both Removal and Withdrawal, much as English Removal shares its root with the Remove object action. The Remove or transfer button, the Removals list and its approval card use it for the umbrella. Do not add the word for transfer to it: _traslado_ and _transfert_ also name custody Transfers, which the Removals list does not hold.
