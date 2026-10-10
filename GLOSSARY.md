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
Removal of an Object, or of an intake request a reviewer declined, from routine views while its record is retained and restorable. It asserts neither a change of title nor disposal; a withdrawn intake was never accessioned, so it never produces a Deaccession.
_Avoid_: Delete, archive (when title or disposal is meant)

### Provenance

**Provenance claim**:
A recorded assertion about who held an Object, in what role, when and how, kept in its author's wording with its evidence and confidence. A correction supersedes a claim, a retraction ends it, and neither rewrites it. Contradictory claims are kept side by side for review.
_Avoid_: Ownership history (the legacy free-text list), provenance entry

**Partial date**:
A historical date known only to a day, month, year or decade, optionally circa, not after, not before, or uncertain. It is never stored as a timestamp.
_Avoid_: Approximate timestamp

### Access

Access has independent dimensions: the Organization's Modules, its Entitlements, and the staff member's Role. A Capability names which of them it needs.

**Module**:
An optional area an Organization turns on in Settings › Modules, such as Library, Accounts or a collection type like Fine Art. Turning a Module on never grants an Entitlement. The Insurance Module only lists Insurance in navigation, because insurance records predate it.
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
A workflow record with its own approval history, such as a loan, transit record, exhibition, conservation treatment, accession, deaccession, move request or library acquisition request.
_Avoid_: Ticket, request (as a general term)

**Task**:
A unit of work waiting on a staff member, such as an installation task or an approval step on a Case.
_Avoid_: To-do, job

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
An approved, version-specific derivative of a single file that may be shown publicly. Publishing an Object does not publish its attachments.
_Avoid_: Public image, published file
