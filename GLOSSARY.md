# MuseumLite

Software for museum staff to manage collections, objects, locations, people, documentation and workflows. Museums are the primary audience; library circulation is an optional module with its own semantics.

## Language

### Institutions and places

**Organization**:
The tenant responsible for an institution's records and its access policy.
_Avoid_: Account, institution (when you mean the tenant)

**Site**:
A physical or operational subdivision of an Organization.
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
A person or institution in a contextual relationship to the museum, such as donor, lender or staff member.
_Avoid_: Contact, donor (as an identity)

### Intake and permanence

**Entry**:
Receipt of an Object into institutional custody for a stated purpose. It may never result in an Acquisition.
_Avoid_: Check-in

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
Removal of an Object from routine views while its record is retained and restorable. It asserts neither a change of title nor disposal.
_Avoid_: Delete, archive (when title or disposal is meant)

### Publication

**Public rendition**:
An approved, version-specific derivative of a single file that may be shown publicly. Publishing an Object does not publish its attachments.
_Avoid_: Public image, published file
